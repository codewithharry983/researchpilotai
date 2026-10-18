import json
from typing import Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.schemas.research import CompareResponse, ComparisonMatrixRow
from app.services.summarizer_service import summarizer_service
from app.services.llm import llm_service


CRITERIA = [
    ("Research Problem", "research_problem"),
    ("Objectives & Goals", "research_objectives"),
    ("Methodology & Architecture", "methodology"),
    ("Datasets & Setup", "dataset_setup"),
    ("Algorithms & Models", "algorithms_models"),
    ("Reported Results & Metrics", "reported_results"),
    ("Limitations", "limitations"),
    ("Future Work", "future_work"),
]


class PaperComparisonService:
    def compare_papers(self, db: Session, documents: List[Document], user_id: str) -> CompareResponse:
        doc_ids = [d.id for d in documents]
        doc_titles = {d.id: d.original_filename for d in documents}

        # 1. Ensure summary exists for each document
        doc_summaries: Dict[str, Dict[str, str]] = {}
        for doc in documents:
            summary_res = summarizer_service.summarize(db, doc, user_id, regenerate=False)
            doc_summaries[doc.id] = {
                k: v.content for k, v in summary_res.sections.items()
            }

        # 2. Build comparison matrix rows
        matrix_rows: List[ComparisonMatrixRow] = []
        for label, key in CRITERIA:
            row_docs: Dict[str, str] = {}
            for doc in documents:
                val = doc_summaries[doc.id].get(key, "Not reported")
                row_docs[doc.id] = val
            matrix_rows.append(ComparisonMatrixRow(
                criterion=label,
                documents=row_docs,
                source_pages={}
            ))

        # 3. Generate objective comparative synthesis
        prompt = (
            "You are an academic peer reviewer. Compare the following research papers objectively.\n\n"
        )
        for doc in documents:
            prompt += f"--- PAPER: {doc.original_filename} ---\n"
            for label, key in CRITERIA:
                prompt += f"{label}: {doc_summaries[doc.id].get(key, 'N/A')}\n"
            prompt += "\n"

        prompt += (
            "Provide an objective comparative synthesis highlighting:\n"
            "1. Core differences in approaches and experimental domains\n"
            "2. Trade-offs between the proposed methodologies\n"
            "3. Incomparable or differing benchmark conditions\n"
            "Do NOT declare a universally superior paper unless explicitly proven by identical benchmarks."
        )

        llm_res = llm_service.generate(
            system_prompt="You are a rigorous, unbiased scientific comparison assistant.",
            user_prompt=prompt
        )

        return CompareResponse(
            document_ids=doc_ids,
            document_titles=doc_titles,
            matrix=matrix_rows,
            synthesis_markdown=llm_res.content
        )


comparison_service = PaperComparisonService()
