from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class UsageRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    endpoint: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    cost_estimate: float
    timestamp: datetime


class UsageSummaryOut(BaseModel):
    total_documents: int
    completed_documents: int
    failed_documents: int
    total_conversations: int
    total_messages: int
    total_notes: int
    total_tokens: int
    total_queries: int
    estimated_cost_usd: float
    avg_latency_ms: float
    token_usage_by_model: Dict[str, int] = {}
    recent_activity: List[UsageRecordOut] = []
