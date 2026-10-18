import re
from typing import List, Dict, Any
from app.services.pdf_extractor import ExtractedPage
from app.core.config import settings


class ChunkItem:
    def __init__(
        self,
        page_number: int,
        chunk_index: int,
        content: str,
        token_count: int,
        metadata: Dict[str, Any] = None
    ):
        self.page_number = page_number
        self.chunk_index = chunk_index
        self.content = content
        self.token_count = token_count
        self.metadata = metadata or {}


class RecursiveTextChunker:
    def __init__(
        self,
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Heuristic token estimation: ~4 chars per token in English text."""
        if not text:
            return 0
        return max(1, len(text.split()))

    def split_text_into_chunks(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks respecting paragraph, sentence, and word boundaries.
        """
        if not text or len(text.strip()) == 0:
            return []

        if len(text) <= self.chunk_size:
            return [text.strip()]

        # Split into primary paragraphs
        paragraphs = text.split("\n\n")
        chunks: List[str] = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph is larger than chunk_size, split by sentences
            if len(para) > self.chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    if len(current_chunk) + len(sent) + 1 <= self.chunk_size:
                        current_chunk = (current_chunk + " " + sent).strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                            # Create overlap from end of current chunk
                            overlap_start = max(0, len(current_chunk) - self.chunk_overlap)
                            current_chunk = current_chunk[overlap_start:].strip() + " " + sent
                        else:
                            # If a single sentence exceeds chunk size, split by words
                            words = sent.split(" ")
                            for word in words:
                                if len(current_chunk) + len(word) + 1 <= self.chunk_size:
                                    current_chunk = (current_chunk + " " + word).strip()
                                else:
                                    if current_chunk:
                                        chunks.append(current_chunk)
                                    current_chunk = word
            else:
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    current_chunk = (current_chunk + "\n\n" + para).strip()
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                        overlap_start = max(0, len(current_chunk) - self.chunk_overlap)
                        current_chunk = current_chunk[overlap_start:].strip() + "\n\n" + para
                    else:
                        current_chunk = para

        if current_chunk and current_chunk not in chunks:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if len(c.strip()) > 10]

    def chunk_document(self, pages: List[ExtractedPage]) -> List[ChunkItem]:
        """
        Chunk extracted pages into semantic chunks while preserving exact page number metadata.
        """
        chunk_items: List[ChunkItem] = []
        global_chunk_idx = 0

        for page in pages:
            if not page.text or len(page.text.strip()) == 0:
                continue

            page_chunks = self.split_text_into_chunks(page.text)
            for c_text in page_chunks:
                tokens = self.estimate_tokens(c_text)
                chunk_items.append(
                    ChunkItem(
                        page_number=page.page_number,
                        chunk_index=global_chunk_idx,
                        content=c_text,
                        token_count=tokens,
                        metadata={
                            "page": page.page_number,
                            "char_length": len(c_text),
                            "estimated_tokens": tokens,
                        }
                    )
                )
                global_chunk_idx += 1

        return chunk_items


chunker_service = RecursiveTextChunker()
