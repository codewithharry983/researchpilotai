import re
import numpy as np
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, text
from app.models.chunk import DocumentChunk
from app.models.document import Document
from app.core.config import settings
from app.services.embeddings import embedding_service


class ScoredChunk:
    def __init__(
        self,
        chunk: DocumentChunk,
        document_title: str,
        vector_score: float = 0.0,
        keyword_score: float = 0.0,
        rrf_score: float = 0.0,
        retrieval_type: str = "hybrid"
    ):
        self.chunk = chunk
        self.chunk_id = chunk.id
        self.document_id = chunk.document_id
        self.document_title = document_title
        self.page_number = chunk.page_number
        self.content = chunk.content
        self.vector_score = vector_score
        self.keyword_score = keyword_score
        self.rrf_score = rrf_score
        self.retrieval_type = retrieval_type


class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, scored_chunks: List[ScoredChunk], top_n: int) -> List[ScoredChunk]:
        pass


class PassThroughReranker(BaseReranker):
    def rerank(self, query: str, scored_chunks: List[ScoredChunk], top_n: int) -> List[ScoredChunk]:
        return scored_chunks[:top_n]


class HybridRetriever:
    def __init__(self, reranker: Optional[BaseReranker] = None):
        self.reranker = reranker or PassThroughReranker()
        self.rrf_k = 60  # Standard RRF smoothing constant

    @staticmethod
    def _compute_cosine_sim(vec_a: List[float], vec_b: List[float]) -> float:
        if not vec_a or not vec_b:
            return 0.0
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    STOPWORDS = {
        "what", "how", "why", "when", "where", "who", "which", "many", "does", "with",
        "from", "that", "this", "have", "been", "were", "will", "would", "could", "should",
        "the", "and", "for", "are", "about", "into", "over", "after", "before", "their", "them"
    }

    @staticmethod
    def _compute_keyword_score(query: str, text: str) -> float:
        """Lexical matching score based on non-stopword token overlap and query coverage."""
        raw_tokens = re.findall(r'\b\w{3,}\b', query.lower())
        q_tokens = set(w for w in raw_tokens if w not in HybridRetriever.STOPWORDS)
        if not q_tokens:
            q_tokens = set(raw_tokens)
        if not q_tokens:
            return 0.0
            
        t_tokens = re.findall(r'\b\w{3,}\b', text.lower())
        if not t_tokens:
            return 0.0

        matches = sum(1 for t in t_tokens if t in q_tokens)
        coverage = len(set(t_tokens).intersection(q_tokens)) / len(q_tokens)
        density = matches / len(t_tokens)
        return float(coverage * 0.7 + density * 0.3)

    def retrieve(
        self,
        db: Session,
        query: str,
        user_id: str,
        document_ids: Optional[List[str]] = None,
        top_k: int = settings.TOP_K,
    ) -> List[ScoredChunk]:
        """
        Executes hybrid vector + keyword retrieval with Reciprocal Rank Fusion (RRF).
        Strictly enforces tenant isolation via user_id.
        """
        # Query embedding
        query_vector = embedding_service.get_embedding(query)

        # Base query for user's chunks
        filters = [DocumentChunk.user_id == user_id]
        if document_ids and len(document_ids) > 0:
            filters.append(DocumentChunk.document_id.in_(document_ids))

        # Join Document to get document title
        query_stmt = (
            select(DocumentChunk, Document.original_filename)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(and_(*filters))
        )
        rows = db.execute(query_stmt).all()
        if not rows:
            return []

        # Vector scoring and Keyword scoring
        vector_candidates: List[Tuple[ScoredChunk, float]] = []
        keyword_candidates: List[Tuple[ScoredChunk, float]] = []

        for chunk, doc_title in rows:
            # 1. Vector score
            emb = chunk.embedding
            if isinstance(emb, list):
                v_score = self._compute_cosine_sim(query_vector, emb)
            else:
                v_score = 0.0

            # 2. Keyword score
            k_score = self._compute_keyword_score(query, chunk.content)

            sc = ScoredChunk(
                chunk=chunk,
                document_title=doc_title,
                vector_score=v_score,
                keyword_score=k_score
            )

            vector_candidates.append((sc, v_score))
            keyword_candidates.append((sc, k_score))

        # Sort ranks
        vector_candidates.sort(key=lambda x: x[1], reverse=True)
        keyword_candidates.sort(key=lambda x: x[1], reverse=True)

        # Build RRF scores
        rrf_map: Dict[str, ScoredChunk] = {}

        # Vector rank contribution
        for rank, (sc, score) in enumerate(vector_candidates[:top_k * 3]):
            sc.rrf_score += settings.VECTOR_SEARCH_WEIGHT / (self.rrf_k + rank + 1)
            sc.retrieval_type = "vector" if sc.rrf_score > 0 else sc.retrieval_type
            rrf_map[sc.chunk_id] = sc

        # Keyword rank contribution
        for rank, (sc, score) in enumerate(keyword_candidates[:top_k * 3]):
            if sc.chunk_id in rrf_map:
                existing = rrf_map[sc.chunk_id]
                existing.rrf_score += settings.KEYWORD_SEARCH_WEIGHT / (self.rrf_k + rank + 1)
                existing.keyword_score = score
                existing.retrieval_type = "hybrid"
            else:
                sc.rrf_score += settings.KEYWORD_SEARCH_WEIGHT / (self.rrf_k + rank + 1)
                sc.retrieval_type = "keyword"
                rrf_map[sc.chunk_id] = sc

        fused_chunks = list(rrf_map.values())
        fused_chunks.sort(key=lambda x: x.rrf_score, reverse=True)

        # Apply reranker if enabled
        if settings.ENABLE_RERANKING:
            return self.reranker.rerank(query, fused_chunks, top_k)

        return fused_chunks[:top_k]


retriever_service = HybridRetriever()
