export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  page_count: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends Document {
  summary_markdown?: string | null;
  chunk_count: number;
}

export interface DocumentStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  error_message?: string | null;
}

export interface DocumentListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Document[];
}

export interface Citation {
  id: string;
  chunk_id?: string | null;
  document_id: string;
  document_title: string;
  page_number: number;
  excerpt: string;
  relevance_score: number;
  is_exact_quote: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  latency_ms?: number | null;
  token_count?: number | null;
  citations: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  selected_document_ids?: string[] | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages?: Message[];
}

export interface SummarySection {
  title: string;
  content: string;
  page_references: number[];
  is_reported: boolean;
}

export interface SummarizeResponse {
  document_id: string;
  document_title: string;
  sections: Record<string, SummarySection>;
  markdown_content: string;
  generated_at: string;
}

export interface ComparisonMatrixRow {
  criterion: string;
  documents: Record<string, string>;
  source_pages?: Record<string, number[]>;
}

export interface CompareResponse {
  document_ids: string[];
  document_titles: Record<string, string>;
  matrix: ComparisonMatrixRow[];
  synthesis_markdown: string;
}

export interface ResearchNote {
  id: string;
  user_id: string;
  document_id?: string | null;
  document_title?: string | null;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  endpoint: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost_estimate: number;
  timestamp: string;
}

export interface UsageSummary {
  total_documents: number;
  completed_documents: number;
  failed_documents: number;
  total_conversations: number;
  total_messages: number;
  total_notes: number;
  total_tokens: number;
  total_queries: number;
  estimated_cost_usd: number;
  avg_latency_ms: number;
  token_usage_by_model: Record<string, number>;
  recent_activity: UsageRecord[];
}

// ==========================================
// ResearchPilot Studio Types
// ==========================================

export interface PodcastScriptSegment {
  speaker: string;
  role: string;
  text: string;
  source_reference?: string;
}

export interface StudioSummaryData {
  overview: string;
  main_topic: string;
  concepts: string[];
  findings: string[];
  examples: string[];
  conclusions: string;
  takeaways: string[];
  sources: string[];
}

export interface StudioNotesData {
  key_concepts?: { term: string; explanation: string }[];
  definitions?: { term: string; definition: string }[];
  main_findings?: string[];
  formulas_or_technical_terms?: string[];
  revision_points?: string[];
  self_test_questions?: { question: string; answer: string }[];
  final_takeaways?: string[];
}

export interface StudioSession {
  id: string;
  user_id: string;
  session_title: string;
  source_type: 'documents' | 'youtube';
  source_metadata: {
    document_ids?: string[];
    document_titles?: string[];
    documents?: { document_id: string; title: string; page_count: number }[];
    youtube_url?: string;
    video_id?: string;
    video_title?: string;
    channel_name?: string;
    thumbnail_url?: string;
    duration_seconds?: number;
    user_provided_transcript?: string;
  };
  podcast_style: 'single_host' | 'two_host' | 'exam_prep' | 'beginner' | 'research_deep_dive';
  target_duration: '3-5' | '5-10' | '10-15';
  summary_length: 'quick' | 'detailed' | 'in_depth';
  generate_notes: boolean;
  summary_data?: StudioSummaryData | null;
  podcast_script?: PodcastScriptSegment[] | null;
  notes_data?: StudioNotesData | null;
  audio_storage_path?: string | null;
  audio_duration_seconds?: number | null;
  status: 'queued' | 'extracting' | 'summarizing' | 'scripting' | 'generating_audio' | 'completed' | 'failed';
  progress: number;
  stage: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioSessionListResponse {
  total: number;
  items: StudioSession[];
}

export interface StudioCreateRequest {
  session_title?: string;
  source_type: 'documents' | 'youtube';
  document_ids?: string[];
  youtube_url?: string;
  user_provided_transcript?: string;
  podcast_style: 'single_host' | 'two_host' | 'exam_prep' | 'beginner' | 'research_deep_dive';
  target_duration: '3-5' | '5-10' | '10-15';
  summary_length: 'quick' | 'detailed' | 'in_depth';
  generate_notes: boolean;
}

export interface YouTubeInspectResponse {
  video_id: string;
  url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  duration_seconds?: number | null;
  has_captions: boolean;
  transcript_snippet?: string | null;
  transcript_word_count: number;
  error_message?: string | null;
}
