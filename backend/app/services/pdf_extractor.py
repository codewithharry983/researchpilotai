import re
from pathlib import Path
from typing import Dict, List, Any
import pymupdf


class ExtractedPage:
    def __init__(self, page_number: int, text: str, image_count: int = 0):
        self.page_number = page_number
        self.text = text
        self.image_count = image_count
        self.char_count = len(text)


class PDFExtractionResult:
    def __init__(
        self,
        pages: List[ExtractedPage],
        total_pages: int,
        requires_ocr: bool = False,
        metadata: Dict[str, Any] = None
    ):
        self.pages = pages
        self.total_pages = total_pages
        self.requires_ocr = requires_ocr
        self.metadata = metadata or {}


class PDFExtractorService:
    @staticmethod
    def clean_text(raw_text: str) -> str:
        """
        Normalize whitespace without destroying paragraph structure or code formatting.
        Preserves double newlines for paragraph breaks.
        """
        if not raw_text:
            return ""

        # Remove null bytes
        text = raw_text.replace("\x00", "")

        # Fix hyphenated line breaks (e.g., "infor-\nmation" -> "information")
        text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)

        # Standardize carriage returns
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Collapse 3 or more newlines into 2
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Collapse multiple horizontal spaces/tabs into a single space
        text = re.sub(r'[ \t]+', ' ', text)

        return text.strip()

    def extract(self, file_path: Path) -> PDFExtractionResult:
        doc = pymupdf.open(str(file_path))
        total_pages = len(doc)
        pages: List[ExtractedPage] = []
        total_chars = 0
        total_images = 0

        metadata = {
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
            "keywords": doc.metadata.get("keywords", ""),
            "creator": doc.metadata.get("creator", ""),
        }

        for idx, page in enumerate(doc):
            page_num = idx + 1
            raw_text = page.get_text("text") or ""
            images = page.get_images()
            image_count = len(images) if images else 0
            total_images += image_count

            cleaned = self.clean_text(raw_text)
            total_chars += len(cleaned)

            pages.append(ExtractedPage(
                page_number=page_num,
                text=cleaned,
                image_count=image_count
            ))

        doc.close()

        # Scanned PDF detection heuristic:
        # If total pages > 0, avg chars per page is very low (< 50 chars) and images exist
        requires_ocr = False
        if total_pages > 0 and (total_chars / total_pages) < 50 and total_images > 0:
            requires_ocr = True

        return PDFExtractionResult(
            pages=pages,
            total_pages=total_pages,
            requires_ocr=requires_ocr,
            metadata=metadata
        )


pdf_extractor = PDFExtractorService()
