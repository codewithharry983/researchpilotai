import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  FileText,
  Video,
  Sparkles,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RotateCcw,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Bookmark,
  ChevronRight,
  Trash2,
  Volume2,
  ListFilter,
  Layers,
  GraduationCap,
  Users,
  Compass,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { StudioSession, StudioCreateRequest } from '../types';
import { formatDate } from '../lib/utils';

export const StudioPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error, info } = useToast();

  // Active Source Tab: 'documents' or 'youtube'
  const [sourceTab, setSourceTab] = useState<'documents' | 'youtube'>('documents');

  // Document selection
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // YouTube selection
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [showTranscriptFallback, setShowTranscriptFallback] = useState(false);

  // Podcast Configuration
  const [sessionTitle, setSessionTitle] = useState('');
  const [podcastStyle, setPodcastStyle] = useState<StudioCreateRequest['podcast_style']>('two_host');
  const [targetDuration, setTargetDuration] = useState<StudioCreateRequest['target_duration']>('3-5');
  const [summaryLength, setSummaryLength] = useState<StudioCreateRequest['summary_length']>('detailed');
  const [generateNotes, setGenerateNotes] = useState(true);

  // Currently viewed session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Output Sub-Tab: 'script' | 'summary' | 'notes'
  const [outputTab, setOutputTab] = useState<'script' | 'summary' | 'notes'>('script');

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Fetch user documents for selection
  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documentsListForStudio'],
    queryFn: () => api.getDocuments({ page: 1, page_size: 50 })
  });

  // Fetch session history
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['studioSessions'],
    queryFn: () => api.getStudioSessions(1, 30)
  });

  // Query active session with polling if generating
  const { data: activeSession } = useQuery({
    queryKey: ['studioSession', activeSessionId],
    queryFn: () => (activeSessionId ? api.getStudioSession(activeSessionId) : null),
    enabled: !!activeSessionId,
    refetchInterval: (query) => {
      const sess = query.state.data as StudioSession | null;
      if (sess && ['queued', 'extracting', 'summarizing', 'scripting', 'generating_audio'].includes(sess.status)) {
        return 2000;
      }
      return false;
    }
  });

  // Set default active session when sessions load
  useEffect(() => {
    if (!activeSessionId && sessionsData?.items && sessionsData.items.length > 0) {
      setActiveSessionId(sessionsData.items[0].id);
    }
  }, [sessionsData, activeSessionId]);

  // YouTube inspection mutation
  const inspectMutation = useMutation({
    mutationFn: () => api.inspectYouTubeVideo(youtubeUrl, userTranscript || undefined),
    onSuccess: (data) => {
      if (data.error_message && !data.has_captions) {
        setShowTranscriptFallback(true);
        info('Captions Unavailable', 'Automated captions are not available for this video. You may paste a transcript below.');
      } else {
        success('Video Inspected', `Loaded "${data.title}" by ${data.channel_name}.`);
        if (!sessionTitle) {
          setSessionTitle(data.title);
        }
      }
    },
    onError: (err: any) => {
      error('Inspection Failed', err.message || 'Could not inspect YouTube URL.');
    }
  });

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: (req: StudioCreateRequest) => api.createStudioSession(req),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['studioSessions'] });
      setActiveSessionId(newSession.id);
      success('Studio Session Started', 'Your research podcast synthesis is now running in the background.');
    },
    onError: (err: any) => {
      error('Generation Failed', err.message || 'Could not initiate podcast synthesis.');
    }
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStudioSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studioSessions'] });
      setActiveSessionId(null);
      success('Session Deleted', 'Studio session and audio assets removed.');
    }
  });

  // Save notes to workspace mutation
  const saveNotesMutation = useMutation({
    mutationFn: (sessionId: string) => api.saveStudioNotes(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      success('Notes Saved!', 'Podcast study notes added directly to your Saved Notes workspace.');
    },
    onError: (err: any) => {
      error('Failed to save notes', err.message || 'Could not save notes.');
    }
  });

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingFile(true);
      const newIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          error('Invalid File Type', `${file.name} is not a PDF.`);
          continue;
        }
        const doc = await api.uploadDocument(file);
        newIds.push(doc.id);
      }
      queryClient.invalidateQueries({ queryKey: ['documentsListForStudio'] });
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...newIds])));
      success('Upload Complete', `Uploaded ${newIds.length} document(s). Processing has started.`);
    } catch (err: any) {
      error('Upload Failed', err.message || 'Could not upload PDF document.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleDocSelect = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleStartGeneration = () => {
    if (sourceTab === 'documents') {
      if (selectedDocIds.length === 0) {
        error('Document Required', 'Please select or upload at least one document.');
        return;
      }
      createMutation.mutate({
        session_title: sessionTitle || undefined,
        source_type: 'documents',
        document_ids: selectedDocIds,
        podcast_style: podcastStyle,
        target_duration: targetDuration,
        summary_length: summaryLength,
        generate_notes: generateNotes
      });
    } else {
      if (!youtubeUrl.trim()) {
        error('URL Required', 'Please enter a valid YouTube video URL.');
        return;
      }
      createMutation.mutate({
        session_title: sessionTitle || undefined,
        source_type: 'youtube',
        youtube_url: youtubeUrl.trim(),
        user_provided_transcript: userTranscript.trim() || undefined,
        podcast_style: podcastStyle,
        target_duration: targetDuration,
        summary_length: summaryLength,
        generate_notes: generateNotes
      });
    }
  };

  // Audio Player Event Listeners
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatAudioTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
    success('Copied to clipboard', `The ${type} has been copied.`);
  };

  const handleDownloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isGenerating = !!activeSession && ['queued', 'extracting', 'summarizing', 'scripting', 'generating_audio'].includes(activeSession.status);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-2">
            <Radio className="h-3.5 w-3.5 animate-pulse text-indigo-600" /> ResearchPilot AI Studio
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            AI Podcast & Research Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Convert scientific papers and YouTube lectures into natural multi-speaker podcasts, structured summaries, and smart study notes.
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-2">
            <Badge variant={activeSession.status === 'completed' ? 'success' : activeSession.status === 'failed' ? 'destructive' : 'warning'}>
              {activeSession.stage || activeSession.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Main Grid: Studio Controls on Left, Results & Player on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Input & Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">1. Select Knowledge Source</CardTitle>
                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setSourceTab('documents')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                      sourceTab === 'documents'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Documents
                  </button>
                  <button
                    onClick={() => setSourceTab('youtube')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                      sourceTab === 'youtube'
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" /> YouTube
                  </button>
                </div>
              </div>
              <CardDescription>
                {sourceTab === 'documents'
                  ? 'Select one or more research papers for multi-paper synthesized audio.'
                  : 'Paste an educational YouTube video URL to analyze transcripts & audio.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              {/* TAB A: DOCUMENTS */}
              {sourceTab === 'documents' && (
                <div className="space-y-4">
                  {/* Upload Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <UploadCloud className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700">
                      {uploadingFile ? 'Uploading and verifying...' : 'Click to upload research PDF(s)'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Supports multi-file upload up to 50MB</p>
                  </div>

                  {/* Document Library Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Or pick from library ({documentsData?.items?.length || 0})</span>
                      {selectedDocIds.length > 0 && (
                        <button
                          onClick={() => setSelectedDocIds([])}
                          className="text-[11px] text-indigo-600 hover:underline"
                        >
                          Clear ({selectedDocIds.length})
                        </button>
                      )}
                    </div>

                    {documentsData?.items && documentsData.items.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDocIds(documentsData.items.slice(0, 2).map((d) => d.id))}
                        className="w-full py-1.5 px-2 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Select Both Landmark Papers (Multi-Paper Synthesis)
                      </button>
                    )}

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {docsLoading ? (
                        <p className="text-slate-400 py-3 text-center">Loading library papers...</p>
                      ) : !documentsData?.items || documentsData.items.length === 0 ? (
                        <p className="text-slate-400 py-3 text-center">No documents uploaded yet.</p>
                      ) : (
                        documentsData.items.map((doc) => {
                          const isSelected = selectedDocIds.includes(doc.id);
                          return (
                            <div
                              key={doc.id}
                              onClick={() => handleToggleDocSelect(doc.id)}
                              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50/60 font-medium text-indigo-950'
                                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="truncate">{doc.original_filename}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400">{doc.page_count} pgs</span>
                                <div
                                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {selectedDocIds.length > 1 && (
                      <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>
                          <strong>Multi-Paper Synthesis:</strong> Studio will compare and synthesize findings across all {selectedDocIds.length} selected papers.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB B: YOUTUBE */}
              {sourceTab === 'youtube' && (
                <div className="space-y-4">
                  {/* Quick Preset Lectures */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Or Try Sample Lecture (1-Click)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { title: '3Blue1Brown: Neural Networks', url: 'https://www.youtube.com/watch?v=aircAruvnKk' },
                        { title: 'Veritasium: Quantum Computers', url: 'https://www.youtube.com/watch?v=lvTqbM5Dq4Q' },
                        { title: 'Karpathy: Intro to LLMs', url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g' },
                        { title: 'MIT: Intro to Algorithms', url: 'https://www.youtube.com/watch?v=ZA-tUyM_y7s' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setYoutubeUrl(preset.url);
                            setSessionTitle(preset.title);
                            setTimeout(() => {
                              inspectMutation.mutate();
                            }, 50);
                          }}
                          className="p-2 text-left bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 rounded-lg text-[11px] font-medium text-slate-700 hover:text-rose-900 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Video className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="truncate">{preset.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">YouTube Video Link</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => inspectMutation.mutate()}
                        isLoading={inspectMutation.isPending}
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>

                  {inspectMutation.data && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex gap-3">
                        {inspectMutation.data.thumbnail_url && (
                          <img
                            src={inspectMutation.data.thumbnail_url}
                            alt="Video Thumbnail"
                            className="w-24 h-16 object-cover rounded-lg shrink-0 border border-slate-200"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 line-clamp-2">
                            {inspectMutation.data.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {inspectMutation.data.channel_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge variant={inspectMutation.data.has_captions ? 'success' : 'warning'}>
                              {inspectMutation.data.has_captions ? 'Captions Available' : 'No Captions Detected'}
                            </Badge>
                            {inspectMutation.data.transcript_word_count > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {inspectMutation.data.transcript_word_count} words
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {inspectMutation.data.transcript_snippet && (
                        <div className="text-[11px] bg-white p-2 rounded border border-slate-100 text-slate-600 line-clamp-2">
                          "{inspectMutation.data.transcript_snippet}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual Transcript Fallback */}
                  {(showTranscriptFallback || !inspectMutation.data?.has_captions) && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">Manual Transcript (Fallback)</label>
                        <span className="text-[10px] text-slate-400">Optional or if captions unavailable</span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Paste lecture transcript or audio subtitles here..."
                        value={userTranscript}
                        onChange={(e) => setUserTranscript(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Card */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">2. Podcast Production Settings</CardTitle>
              <CardDescription>Select presentation style, voice setup, and target length</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Optional Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Podcast Title (Optional)</label>
                <Input
                  placeholder="e.g. Breakthroughs in Quantum Attention"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              {/* Style Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Podcast Style</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'two_host',
                      title: 'Two-Host Discussion',
                      desc: 'Alex (Host 1) & Taylor (Host 2) explore concepts through dynamic conversation.',
                      icon: Users
                    },
                    {
                      id: 'single_host',
                      title: 'Single-Host Lecture',
                      desc: 'Clear, authoritative monologue delivered by an expert narrator.',
                      icon: Radio
                    },
                    {
                      id: 'exam_prep',
                      title: 'Exam Preparation & High-Yield Review',
                      desc: 'Sharply focused on definitions, formulas, revision points, and tests.',
                      icon: GraduationCap
                    },
                    {
                      id: 'beginner',
                      title: 'Beginner-Friendly Explanation',
                      desc: 'Intuitive analogies and everyday metaphors without dumbing down facts.',
                      icon: Compass
                    },
                    {
                      id: 'research_deep_dive',
                      title: 'Research Critical Deep-Dive',
                      desc: 'Dissects methodology, baselines, error bounds, and experimental limits.',
                      icon: Sparkles
                    }
                  ].map((st) => {
                    const isSel = podcastStyle === st.id;
                    const IconComp = st.icon;
                    return (
                      <div
                        key={st.id}
                        onClick={() => setPodcastStyle(st.id as any)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSel
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-md mt-0.5 ${
                            isSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${isSel ? 'text-indigo-950' : 'text-slate-800'}`}>
                            {st.title}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{st.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Length & Summary Depth */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Duration</label>
                  <select
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="3-5">3–5 minutes (Quick Brief)</option>
                    <option value="5-10">5–10 minutes (Standard)</option>
                    <option value="10-15">10–15 minutes (Deep)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Summary Depth</label>
                  <select
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="quick">Quick Overview</option>
                    <option value="detailed">Detailed Breakdown</option>
                    <option value="in_depth">In-Depth Analysis</option>
                  </select>
                </div>
              </div>

              {/* Important Notes Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">Generate Important Study Notes</p>
                  <p className="text-[11px] text-slate-500">Key definitions, formulas & self-testing questions</p>
                </div>
                <input
                  type="checkbox"
                  checked={generateNotes}
                  onChange={(e) => setGenerateNotes(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Generate Action Button */}
              <Button
                onClick={handleStartGeneration}
                isLoading={createMutation.isPending || isGenerating}
                className="w-full shadow-md shadow-indigo-600/20 py-2.5 font-bold text-sm"
              >
                <Sparkles className="h-4 w-4 mr-2" /> Generate Podcast & Research Brief
              </Button>
            </CardContent>
          </Card>

          {/* Past Sessions Drawer */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" /> Session History ({sessionsData?.total || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1 max-h-56 overflow-y-auto">
              {sessionsLoading ? (
                <p className="text-xs text-slate-400 p-3 text-center">Loading past sessions...</p>
              ) : !sessionsData?.items || sessionsData.items.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 text-center">No studio sessions created yet.</p>
              ) : (
                sessionsData.items.map((sess) => {
                  const isActive = activeSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => setActiveSessionId(sess.id)}
                      className={`p-2 rounded-lg flex items-center justify-between cursor-pointer text-xs transition-colors ${
                        isActive ? 'bg-indigo-50 font-medium text-indigo-950' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          {sess.source_type === 'youtube' ? (
                            <Video className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          )}
                          <span className="truncate">{sess.session_title}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(sess.created_at)}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={sess.status === 'completed' ? 'success' : sess.status === 'failed' ? 'destructive' : 'warning'}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {sess.status}
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this studio session and generated audio?')) {
                              deleteMutation.mutate(sess.id);
                            }
                          }}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Player & Generated Output (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Generation Progress Card */}
          {isGenerating && activeSession && (
            <Card className="border-indigo-200 bg-indigo-50/40 shadow-xs">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-indigo-600 animate-spin" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Synthesizing Podcast & Research Output</p>
                      <p className="text-xs text-indigo-700">{activeSession.stage}</p>
                    </div>
                  </div>
                  <Badge variant="warning">{activeSession.progress}%</Badge>
                </div>

                <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(5, activeSession.progress)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>1. Extract Content</span>
                  <span>2. Structured Summary</span>
                  <span>3. Conversational Script</span>
                  <span>4. Neural TTS Audio</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failure Alert */}
          {activeSession?.status === 'failed' && (
            <Card className="border-rose-200 bg-rose-50/50">
              <CardContent className="p-5 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-rose-900">Production Failed</p>
                  <p className="text-xs text-rose-700">{activeSession.error_message || 'An error occurred during podcast synthesis.'}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => api.retryStudioSession(activeSession.id).then(() => queryClient.invalidateQueries())}
                    className="mt-2 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Session Player & Artifacts */}
          {activeSession && activeSession.status === 'completed' && (
            <div className="space-y-6">
              {/* Integrated Audio Player Card */}
              <Card className="shadow-md border-indigo-200 bg-gradient-to-br from-white via-indigo-50/20 to-white">
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {activeSession.podcast_style.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-500">
                          Est. {activeSession.target_duration} mins
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-1">
                        {activeSession.session_title}
                      </h2>
                    </div>

                    <a
                      href={api.getStudioAudioUrl(activeSession.id)}
                      download={`${activeSession.session_title}.mp3`}
                    >
                      <Button variant="outline" size="sm" className="text-xs font-semibold">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download MP3
                      </Button>
                    </a>
                  </div>

                  {/* HTML5 Audio element */}
                  <audio
                    ref={audioRef}
                    src={api.getStudioAudioUrl(activeSession.id)}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />

                  {/* Custom Player Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayPause}
                        className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-200 transition-transform active:scale-95"
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                      </button>

                      <div className="flex-1 space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-[11px] font-mono text-slate-500">
                          <span>{formatAudioTime(currentTime)}</span>
                          <span>{formatAudioTime(duration || (activeSession.audio_duration_seconds || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Speed Controls */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 mr-1 font-semibold uppercase">Speed:</span>
                      {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleSpeedChange(rate)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            playbackRate === rate
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Artifacts Tabs: Script, Summary, Notes */}
              <div className="space-y-4">
                <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
                  <button
                    onClick={() => setOutputTab('script')}
                    className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      outputTab === 'script'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Radio className="h-4 w-4" /> Podcast Script ({activeSession.podcast_script?.length || 0})
                  </button>
                  <button
                    onClick={() => setOutputTab('summary')}
                    className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      outputTab === 'summary'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileCheck className="h-4 w-4" /> Structured Summary
                  </button>
                  {activeSession.notes_data && (
                    <button
                      onClick={() => setOutputTab('notes')}
                      className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                        outputTab === 'notes'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" /> Smart Notes & Self-Test
                    </button>
                  )}
                </div>

                {/* SCRIPT VIEWER */}
                {outputTab === 'script' && activeSession.podcast_script && (
                  <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Spoken dialogue validated against primary research passages
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyText(
                            activeSession.podcast_script!
                              .map((s) => `${s.speaker} (${s.role}):\n${s.text}\n`)
                              .join('\n'),
                            'script'
                          )
                        }
                        className="text-xs"
                      >
                        {copiedType === 'script' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                        Copy Script
                      </Button>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
                      {activeSession.podcast_script.map((seg, idx) => {
                        const isAlex = seg.speaker.toLowerCase().includes('alex') || seg.role.toLowerCase().includes('host 1');
                        const isTaylor = seg.speaker.toLowerCase().includes('taylor') || seg.role.toLowerCase().includes('host 2');
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex gap-3 ${
                              isAlex
                                ? 'bg-indigo-50/40 border-indigo-200'
                                : isTaylor
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 text-white ${
                                isAlex ? 'bg-indigo-600' : isTaylor ? 'bg-emerald-600' : 'bg-slate-700'
                              }`}
                            >
                              {seg.speaker[0]}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{seg.speaker}</span>
                                <span className="text-[10px] text-slate-400">({seg.role})</span>
                                {seg.source_reference && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 ml-auto">
                                    {seg.source_reference}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed">{seg.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* SUMMARY VIEWER */}
                {outputTab === 'summary' && activeSession.summary_data && (
                  <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Structured objective breakdown grounded in verified content
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyText(JSON.stringify(activeSession.summary_data, null, 2), 'summary')}
                          className="text-xs"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const md = `# ${activeSession.summary_data?.main_topic}\n\n## Overview\n${activeSession.summary_data?.overview}\n\n## Key Findings\n${activeSession.summary_data?.findings?.map((f) => `- ${f}`).join('\n')}\n\n## Conclusions\n${activeSession.summary_data?.conclusions}\n`;
                            handleDownloadMarkdown(`${activeSession.session_title}_Summary.md`, md);
                          }}
                          className="text-xs"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Export MD
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm mb-1">Executive Overview</h4>
                        <p className="p-3 bg-slate-50 rounded-lg border border-slate-100">{activeSession.summary_data.overview}</p>
                      </div>

                      {activeSession.summary_data.concepts?.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1.5">Core Concepts & Principles</h4>
                          <div className="flex flex-wrap gap-2">
                            {activeSession.summary_data.concepts.map((c, i) => (
                              <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeSession.summary_data.findings?.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1.5">Key Evidence-Grounded Findings</h4>
                          <ul className="space-y-1.5 list-disc pl-5">
                            {activeSession.summary_data.findings.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeSession.summary_data.conclusions && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1">Conclusions & Contributions</h4>
                          <p>{activeSession.summary_data.conclusions}</p>
                        </div>
                      )}

                      {activeSession.summary_data.takeaways?.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1.5">Actionable Takeaways</h4>
                          <ul className="space-y-1 list-disc pl-5 text-indigo-900">
                            {activeSession.summary_data.takeaways.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* NOTES VIEWER */}
                {outputTab === 'notes' && activeSession.notes_data && (
                  <Card className="shadow-xs border-slate-200">
                    <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
                      <p className="text-xs text-slate-500">
                        High-yield definitions, formula notes, and self-testing Q&A
                      </p>
                      <Button
                        size="sm"
                        onClick={() => saveNotesMutation.mutate(activeSession.id)}
                        isLoading={saveNotesMutation.isPending}
                        className="text-xs font-semibold"
                      >
                        <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Save to My Notes
                      </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-xs text-slate-700">
                      {/* Key Concepts */}
                      {activeSession.notes_data.key_concepts && activeSession.notes_data.key_concepts.length > 0 && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-2">Key Concepts & Terminology</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeSession.notes_data.key_concepts.map((kc, i) => (
                              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="font-bold text-indigo-900 text-xs">{kc.term}</p>
                                <p className="text-[11px] text-slate-600 mt-1">{kc.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Revision Points */}
                      {activeSession.notes_data.revision_points && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1.5">High-Yield Revision Points</h4>
                          <ul className="space-y-1.5 list-disc pl-5">
                            {activeSession.notes_data.revision_points.map((rp, i) => (
                              <li key={i}>{rp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Interactive Self-Testing Q&A */}
                      {activeSession.notes_data.self_test_questions && (
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-2">Interactive Self-Testing Cards</h4>
                          <div className="space-y-2">
                            {activeSession.notes_data.self_test_questions.map((q, i) => {
                              const isRev = !!revealedAnswers[i];
                              return (
                                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-slate-800 text-xs">
                                      Q{i + 1}: {q.question}
                                    </p>
                                    <button
                                      onClick={() => setRevealedAnswers((prev) => ({ ...prev, [i]: !prev[i] }))}
                                      className="text-[10px] text-indigo-600 font-bold hover:underline shrink-0"
                                    >
                                      {isRev ? 'Hide Answer' : 'Reveal Answer'}
                                    </button>
                                  </div>
                                  {isRev && (
                                    <div className="mt-2 p-2 bg-emerald-50/60 rounded border border-emerald-200 text-emerald-900 text-[11px]">
                                      <strong>Answer:</strong> {q.answer}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!activeSession && (
            <Card className="border-dashed border-2 border-slate-200 py-16 text-center">
              <CardContent className="space-y-3">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
                  <Radio className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Your Studio Workspace is Ready</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select research papers on the left or paste an educational YouTube lecture to generate your first natural audio podcast.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
