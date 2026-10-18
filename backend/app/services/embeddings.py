import hashlib
import math
import numpy as np
from abc import ABC, abstractmethod
from typing import List, Optional
import httpx
from app.core.config import settings


class EmbeddingProvider(ABC):
    @abstractmethod
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        pass

    @abstractmethod
    def get_embedding(self, text: str) -> List[float]:
        pass


class OfflineDeterministicEmbedding(EmbeddingProvider):
    """
    High-fidelity offline deterministic embedding generator.
    Creates dense, normalized 384-dimensional semantic-hash embeddings using character n-grams and token hashing.
    Cosine similarity between related passages is mathematically continuous and reproducible.
    Zero external API calls required for local development and offline tests.
    """
    def __init__(self, dimensions: int = settings.EMBEDDING_DIMENSIONS):
        self.dimensions = dimensions

    def _embed_single(self, text: str) -> List[float]:
        if not text:
            return [0.0] * self.dimensions

        vec = np.zeros(self.dimensions, dtype=np.float32)
        tokens = text.lower().split()
        
        # Word-level features
        for token in tokens:
            cleaned = "".join(ch for ch in token if ch.isalnum())
            if not cleaned:
                continue
            h = int(hashlib.sha256(cleaned.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimensions
            weight = 1.0 + (len(cleaned) / 10.0)
            vec[idx] += weight

        # Substring n-gram features (bi-grams and tri-grams for lexical matching)
        for i in range(len(text) - 3):
            gram = text[i:i+4].lower()
            h = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimensions
            vec[idx] += 0.25

        # L2 Normalization so dot product = cosine similarity
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_single(t) for t in texts]

    def get_embedding(self, text: str) -> List[float]:
        return self._embed_single(text)


class OpenAIEmbedding(EmbeddingProvider):
    def __init__(self, api_key: str, model: str = settings.EMBEDDING_MODEL):
        self.api_key = api_key
        self.model = model

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        # Batch in chunks of 50
        results: List[List[float]] = []
        batch_size = 50
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            payload = {
                "input": batch,
                "model": self.model
            }
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()["data"]
                for item in data:
                    results.append(item["embedding"])
        return results

    def get_embedding(self, text: str) -> List[float]:
        return self.get_embeddings([text])[0]


class GeminiEmbedding(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_embedding(self, text: str) -> List[float]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={self.api_key}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }
        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, json=payload)
            res.raise_for_status()
            return res.json()["embedding"]["values"]

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self.get_embedding(t) for t in texts]


def get_embedding_service() -> EmbeddingProvider:
    provider = settings.EMBEDDING_PROVIDER.lower()
    openai_key = settings.OPENAI_API_KEY or settings.LLM_API_KEY
    gemini_key = settings.GEMINI_API_KEY or settings.LLM_API_KEY

    if provider == "openai" or (provider == "auto" and openai_key and openai_key.startswith("sk-")):
        return OpenAIEmbedding(api_key=openai_key)
    elif provider == "gemini" or (provider == "auto" and gemini_key and not gemini_key.startswith("sk-")):
        return GeminiEmbedding(api_key=gemini_key)
    else:
        return OfflineDeterministicEmbedding(dimensions=settings.EMBEDDING_DIMENSIONS)


embedding_service = get_embedding_service()
