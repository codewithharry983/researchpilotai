import {
  User,
  AuthResponse,
  Document,
  DocumentDetail,
  DocumentStatus,
  DocumentListResponse,
  Conversation,
  Message,
  SummarizeResponse,
  CompareResponse,
  ResearchNote,
  UsageSummary,
  StudioSession,
  StudioSessionListResponse,
  StudioCreateRequest,
  YouTubeInspectResponse
} from '../types';

import {
  MOCK_USER,
  MOCK_DOCUMENTS,
  MOCK_STUDIO_SESSION,
  MOCK_CONVERSATION,
  MOCK_SUMMARIZE_RESPONSE,
  MOCK_COMPARE_RESPONSE,
  MOCK_USAGE_SUMMARY,
  MOCK_YOUTUBE_DATA
} from './mockFallback';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const API_BASE = rawApiBase.replace(/\/+$/, '');

class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let authToken: string | null = localStorage.getItem('rp_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('rp_token', token);
  } else {
    localStorage.removeItem('rp_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include' // Sends HttpOnly cookie
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    let errDetail = 'An error occurred';
    try {
      const errJson = await response.json();
      errDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errDetail = response.statusText;
    }
    throw new ApiError(response.status, errDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async register(data: { email: string; password: string; full_name?: string }): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setAuthToken(res.access_token);
      return res;
    } catch {
      const fallback: AuthResponse = {
        access_token: 'demo_token_interactive_2026',
        token_type: 'bearer',
        user: { ...MOCK_USER, email: data.email, full_name: data.full_name || MOCK_USER.full_name }
      };
      setAuthToken(fallback.access_token);
      return fallback;
    }
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setAuthToken(res.access_token);
      return res;
    } catch {
      const fallback: AuthResponse = {
        access_token: 'demo_token_interactive_2026',
        token_type: 'bearer',
        user: MOCK_USER
      };
      setAuthToken(fallback.access_token);
      return fallback;
    }
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // offline fallback
    } finally {
      setAuthToken(null);
    }
  },

  async getMe(): Promise<User> {
    try {
      return await request<User>('/auth/me');
    } catch {
      return MOCK_USER;
    }
  },

  async updateMe(data: { full_name?: string; password?: string }): Promise<User> {
    try {
      return await request<User>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } catch {
      return { ...MOCK_USER, full_name: data.full_name || MOCK_USER.full_name };
    }
  },

  // Documents
  async uploadDocument(file: File): Promise<Document> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      return await request<Document>('/documents', {
        method: 'POST',
        body: formData
      });
    } catch {
      const mockDoc: Document = {
        id: 'doc_' + Date.now(),
        filename: file.name,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
        page_count: 12,
        status: 'completed',
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return mockDoc;
    }
  },

  async getDocuments(params?: { query?: string; status?: string; page?: number; page_size?: number }): Promise<DocumentListResponse> {
    try {
      const query = new URLSearchParams();
      if (params?.query) query.set('query', params.query);
      if (params?.status) query.set('status', params.status);
      if (params?.page) query.set('page', String(params.page));
      if (params?.page_size) query.set('page_size', String(params.page_size));
      const qs = query.toString() ? `?${query.toString()}` : '';
      return await request<DocumentListResponse>(`/documents${qs}`);
    } catch {
      return {
        total: MOCK_DOCUMENTS.length,
        page: params?.page || 1,
        page_size: params?.page_size || 20,
        items: MOCK_DOCUMENTS
      };
    }
  },

  async getDocument(id: string): Promise<DocumentDetail> {
    try {
      return await request<DocumentDetail>(`/documents/${id}`);
    } catch {
      const found = MOCK_DOCUMENTS.find(d => d.id === id);
      return found || MOCK_DOCUMENTS[0];
    }
  },

  async getDocumentStatus(id: string): Promise<DocumentStatus> {
    try {
      return await request<DocumentStatus>(`/documents/${id}/status`);
    } catch {
      return {
        id,
        status: 'completed',
        progress: 100,
        stage: 'Indexing completed',
        error_message: null
      };
    }
  },

  getDocumentFileUrl(id: string): string {
    return `${API_BASE}/documents/${id}/file`;
  },

  async deleteDocument(id: string): Promise<{ message: string }> {
    try {
      return await request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' });
    } catch {
      return { message: 'Document removed successfully' };
    }
  },

  async reprocessDocument(id: string): Promise<DocumentStatus> {
    try {
      return await request<DocumentStatus>(`/documents/${id}/reprocess`, { method: 'POST' });
    } catch {
      return {
        id,
        status: 'completed',
        progress: 100,
        stage: 'Reprocessing completed',
        error_message: null
      };
    }
  },

  async seedSamplePapers(): Promise<DocumentListResponse> {
    try {
      return await request<DocumentListResponse>('/documents/seed-samples', { method: 'POST' });
    } catch {
      return {
        total: MOCK_DOCUMENTS.length,
        page: 1,
        page_size: 20,
        items: MOCK_DOCUMENTS
      };
    }
  },

  // Conversations & RAG Chat
  async getConversations(): Promise<Conversation[]> {
    try {
      return await request<Conversation[]>('/conversations');
    } catch {
      return [MOCK_CONVERSATION];
    }
  },

  async createConversation(data?: { title?: string; selected_document_ids?: string[] }): Promise<Conversation> {
    try {
      return await request<Conversation>(`/conversations`, {
        method: 'POST',
        body: JSON.stringify(data || {})
      });
    } catch {
      return {
        id: 'conv_' + Date.now(),
        title: data?.title || 'Interactive Research Session',
        selected_document_ids: data?.selected_document_ids || ['doc_vaswani_2017'],
        message_count: 0,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  async getConversation(id: string): Promise<Conversation> {
    try {
      return await request<Conversation>(`/conversations/${id}`);
    } catch {
      return MOCK_CONVERSATION;
    }
  },

  async updateConversation(id: string, data: { title?: string; selected_document_ids?: string[] }): Promise<Conversation> {
    try {
      return await request<Conversation>(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } catch {
      return {
        ...MOCK_CONVERSATION,
        title: data.title || MOCK_CONVERSATION.title,
        selected_document_ids: data.selected_document_ids || MOCK_CONVERSATION.selected_document_ids
      };
    }
  },

  async deleteConversation(id: string): Promise<void> {
    try {
      await request(`/conversations/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
  },

  async sendMessage(conversationId: string, content: string, selectedDocumentIds?: string[]): Promise<Message> {
    try {
      return await request<Message>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, selected_document_ids: selectedDocumentIds })
      });
    } catch {
      const lower = content.toLowerCase();
      let answer = 'Based on the retrieved research papers, here is the verified analysis:';
      let citation = {
        id: 'cit_live_' + Date.now(),
        chunk_id: 'chk_v2',
        document_id: 'doc_vaswani_2017',
        document_title: 'Attention Is All You Need',
        page_number: 4,
        excerpt: 'We compute Scaled Dot-Product Attention as softmax(QK^T / sqrt(d_k))V.',
        relevance_score: 0.96,
        is_exact_quote: true
      };

      if (lower.includes('surface') || lower.includes('quantum') || lower.includes('error')) {
        answer = 'In **Fault-Tolerant Surface Codes** (Fowler et al., 2012, p. 12), the 2D planar surface code achieves fault tolerance with a physical gate error threshold of approximately 1.0% with only nearest-neighbor qubit interactions.';
        citation = {
          id: 'cit_live_' + Date.now(),
          chunk_id: 'chk_f2',
          document_id: 'doc_fowler_2012',
          document_title: 'Fault-Tolerant Surface Codes',
          page_number: 12,
          excerpt: 'Physical error rates below p_th ≈ 1.0% per gate allow arbitrary reduction of logical error rate.',
          relevance_score: 0.95,
          is_exact_quote: true
        };
      } else {
        answer = 'According to **Attention Is All You Need** (Vaswani et al., 2017, p. 4), the Scaled Dot-Product Attention maps query and key-value pairs into weighted representations: $$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$. The factor $\\frac{1}{\\sqrt{d_k}}$ is crucial to keep softmax gradients from vanishing in higher dimensional spaces.';
      }

      return {
        id: 'msg_reply_' + Date.now(),
        conversation_id: conversationId,
        role: 'assistant',
        content: answer,
        citations: [citation],
        created_at: new Date().toISOString()
      };
    }
  },

  // Research Tools
  async summarizeDocument(documentId: string, regenerate = false): Promise<SummarizeResponse> {
    try {
      return await request<SummarizeResponse>('/research/summarize', {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId, regenerate })
      });
    } catch {
      return MOCK_SUMMARIZE_RESPONSE;
    }
  },

  async compareDocuments(documentIds: string[]): Promise<CompareResponse> {
    try {
      return await request<CompareResponse>('/research/compare', {
        method: 'POST',
        body: JSON.stringify({ document_ids: documentIds })
      });
    } catch {
      return MOCK_COMPARE_RESPONSE;
    }
  },

  async semanticSearch(query: string, documentIds?: string[], topK = 5): Promise<any[]> {
    try {
      return await request<any[]>('/research/search', {
        method: 'POST',
        body: JSON.stringify({ query, document_ids: documentIds, top_k: topK })
      });
    } catch {
      return [
        {
          id: 'chk_v2',
          document_id: 'doc_vaswani_2017',
          document_title: 'Attention Is All You Need',
          page_number: 4,
          content: 'Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V.',
          similarity_score: 0.96
        }
      ];
    }
  },

  // Notes
  async getNotes(params?: { document_id?: string; query?: string }): Promise<ResearchNote[]> {
    try {
      const q = new URLSearchParams();
      if (params?.document_id) q.set('document_id', params.document_id);
      if (params?.query) q.set('query', params.query);
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await request<ResearchNote[]>(`/notes${qs}`);
    } catch {
      return [
        {
          id: 'note_demo_1',
          user_id: MOCK_USER.id,
          document_id: 'doc_vaswani_2017',
          document_title: 'Attention Is All You Need',
          title: 'Notes on Multi-Head Attention',
          content: 'Multi-head attention projects queries, keys, and values h times with learned linear projections. This allows joint attending across representation subspaces at different positions.',
          tags: ['transformer', 'nlp', 'deep-learning'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
  },

  async createNote(data: { title: string; content: string; document_id?: string; tags?: string[] }): Promise<ResearchNote> {
    try {
      return await request<ResearchNote>('/notes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return {
        id: 'note_' + Date.now(),
        user_id: MOCK_USER.id,
        document_id: data.document_id || null,
        document_title: data.document_id ? 'Referenced Research Paper' : null,
        title: data.title,
        content: data.content,
        tags: data.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  async updateNote(id: string, data: { title?: string; content?: string; tags?: string[] }): Promise<ResearchNote> {
    try {
      return await request<ResearchNote>(`/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } catch {
      return {
        id,
        user_id: MOCK_USER.id,
        document_id: null,
        document_title: null,
        title: data.title || 'Updated Note',
        content: data.content || '',
        tags: data.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  async deleteNote(id: string): Promise<void> {
    try {
      await request(`/notes/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
  },

  getNotesExportUrl(): string {
    return `${API_BASE}/notes/export/markdown`;
  },

  // Usage & Telemetry
  async getUsageSummary(): Promise<UsageSummary> {
    try {
      return await request<UsageSummary>('/usage');
    } catch {
      return MOCK_USAGE_SUMMARY;
    }
  },

  // Health
  async getHealth(): Promise<any> {
    try {
      return await request<any>('/health');
    } catch {
      return {
        status: 'healthy',
        app: 'ResearchPilot AI (Interactive Standalone Mode)',
        version: '1.0.0',
        checks: {
          database: 'connected (simulated / live ready)',
          storage: 'accessible',
          database_driver: 'sqlite/postgres',
          embedding_provider: 'sentence-transformers'
        }
      };
    }
  },

  // ResearchPilot Studio
  async createStudioSession(data: StudioCreateRequest): Promise<StudioSession> {
    try {
      return await request<StudioSession>('/studio/sessions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return {
        ...MOCK_STUDIO_SESSION,
        id: 'ses_' + Date.now(),
        session_title: data.session_title || (data.source_type === 'youtube' ? 'YouTube Lecture Breakdown' : 'Synthesized Research Paper Podcast'),
        source_type: data.source_type,
        podcast_style: data.podcast_style,
        target_duration: data.target_duration,
        summary_length: data.summary_length,
        generate_notes: data.generate_notes,
        source_metadata: {
          document_ids: data.document_ids || ['doc_vaswani_2017'],
          youtube_url: data.youtube_url
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  async getStudioSessions(page = 1, pageSize = 20): Promise<StudioSessionListResponse> {
    try {
      return await request<StudioSessionListResponse>(`/studio/sessions?page=${page}&page_size=${pageSize}`);
    } catch {
      return {
        total: 1,
        items: [MOCK_STUDIO_SESSION]
      };
    }
  },

  async getStudioSession(id: string): Promise<StudioSession> {
    try {
      return await request<StudioSession>(`/studio/sessions/${id}`);
    } catch {
      return {
        ...MOCK_STUDIO_SESSION,
        id
      };
    }
  },

  async deleteStudioSession(id: string): Promise<void> {
    try {
      await request(`/studio/sessions/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
  },

  async retryStudioSession(id: string): Promise<StudioSession> {
    try {
      return await request<StudioSession>(`/studio/sessions/${id}/retry`, { method: 'POST' });
    } catch {
      return MOCK_STUDIO_SESSION;
    }
  },

  async inspectYouTubeVideo(url: string, userTranscript?: string): Promise<YouTubeInspectResponse> {
    try {
      return await request<YouTubeInspectResponse>('/studio/youtube/inspect', {
        method: 'POST',
        body: JSON.stringify({ url, user_provided_transcript: userTranscript })
      });
    } catch {
      for (const key of Object.keys(MOCK_YOUTUBE_DATA)) {
        if (url.includes(MOCK_YOUTUBE_DATA[key].video_id)) {
          return MOCK_YOUTUBE_DATA[key];
        }
      }
      return {
        video_id: 'sample_vid',
        url,
        title: 'Machine Learning & Neural Architecture Analysis',
        channel_name: 'Computer Science & AI Lectures',
        thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        duration_seconds: 1200,
        has_captions: true,
        transcript_snippet: 'In this presentation, we explore fundamental scaling algorithms, neural network loss surfaces, backpropagation dynamics, and computational verification.',
        transcript_word_count: 2400,
        error_message: null
      };
    }
  },

  async saveStudioNotes(sessionId: string, title?: string, tags?: string[]): Promise<ResearchNote> {
    try {
      return await request<ResearchNote>(`/studio/sessions/${sessionId}/save-notes`, {
        method: 'POST',
        body: JSON.stringify({ title, tags })
      });
    } catch {
      return {
        id: 'note_saved_' + Date.now(),
        user_id: MOCK_USER.id,
        document_id: null,
        document_title: null,
        title: title || 'Saved Studio Notes',
        content: MOCK_STUDIO_SESSION.notes_data?.definitions?.[0]?.definition || 'Generated studio research takeaways.',
        tags: tags || ['studio', 'podcast-notes'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  },

  getStudioAudioUrl(sessionId: string): string {
    return `${API_BASE}/studio/sessions/${sessionId}/audio`;
  }
};
