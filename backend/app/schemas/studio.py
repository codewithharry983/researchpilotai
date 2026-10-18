from datetime import datetime
from typing import Dict, List, Optional, Any, Literal
from pydantic import BaseModel, Field, ConfigDict


class StudioCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_title: Optional[str] = None
    source_type: Literal["documents", "youtube"] = "documents"
    document_ids: Optional[List[str]] = Field(default_factory=list)
    youtube_url: Optional[str] = None
    user_provided_transcript: Optional[str] = None
    podcast_style: Literal["single_host", "two_host", "exam_prep", "beginner", "research_deep_dive"] = "two_host"
    target_duration: Literal["3-5", "5-10", "10-15"] = "3-5"
    summary_length: Literal["quick", "detailed", "in_depth"] = "detailed"
    generate_notes: bool = True


class YouTubeInspectRequest(BaseModel):
    url: str
    user_provided_transcript: Optional[str] = None


class YouTubeInspectResponse(BaseModel):
    video_id: str
    url: str
    title: str
    channel_name: str
    thumbnail_url: str
    duration_seconds: Optional[int] = None
    has_captions: bool
    transcript_snippet: Optional[str] = None
    transcript_word_count: int = 0
    error_message: Optional[str] = None


class PodcastScriptSegment(BaseModel):
    speaker: str
    role: str
    text: str
    source_reference: Optional[str] = None


class StudioSummaryData(BaseModel):
    overview: str
    main_topic: str
    concepts: List[str] = []
    findings: List[str] = []
    examples: List[str] = []
    conclusions: str = ""
    takeaways: List[str] = []
    sources: List[str] = []


class StudioNotesData(BaseModel):
    key_concepts: List[Dict[str, str]] = []
    definitions: List[Dict[str, str]] = []
    main_findings: List[str] = []
    formulas_or_technical_terms: List[str] = []
    revision_points: List[str] = []
    self_test_questions: List[Dict[str, str]] = []
    final_takeaways: List[str] = []


class StudioSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    session_title: str
    source_type: str
    source_metadata: Dict[str, Any]
    podcast_style: str
    target_duration: str
    summary_length: str
    generate_notes: bool
    summary_data: Optional[Dict[str, Any]] = None
    podcast_script: Optional[List[Dict[str, Any]]] = None
    notes_data: Optional[Dict[str, Any]] = None
    audio_storage_path: Optional[str] = None
    audio_duration_seconds: Optional[float] = None
    status: str
    progress: int
    stage: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class StudioSessionListOut(BaseModel):
    total: int
    items: List[StudioSessionOut]


class SaveNotesRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=lambda: ["studio", "podcast", "ai-notes"])
