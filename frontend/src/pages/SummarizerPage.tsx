import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  FileText,
  Copy,
  Download,
  RefreshCw,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { Document, SummarizeResponse, SummarySection } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export const SummarizerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [selectedDocId, setSelectedDocId] = useState<string>(searchParams.get('docId') || '');
  const [copied, setCopied] = useState(false);

  // Load all user completed documents
  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documentsCompleted'],
    queryFn: () => api.getDocuments({ status: 'completed', page_size: 100 })
  });
  const completedDocs: Document[] = documentsData?.items || [];

  // Automatically select first doc if none selected
  useEffect(() => {
    if (!selectedDocId && completedDocs.length > 0) {
      setSelectedDocId(completedDocs[0].id);
    }
  }, [completedDocs, selectedDocId]);

  // Summarize query
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['summary', selectedDocId],
    queryFn: () => (selectedDocId ? api.summarizeDocument(selectedDocId) : null),
    enabled: !!selectedDocId
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: () => api.summarizeDocument(selectedDocId, true),
    onSuccess: (data) => {
      success('Summary regenerated', 'Extracted updated structured breakdown from the paper.');
      refetchSummary();
    },
    onError: (err: any) => {
      error('Summarization failed', err.message);
    }
  });

  const handleCopyMarkdown = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.markdown_content);
    setCopied(true);
    success('Copied Markdown', 'Full structured summary copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!summary) return;
    const blob = new Blob([summary.markdown_content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.document_title.replace(/\.[^/.]+$/, '')}_summary.md`;
    a.click();
    URL.revokeObjectURL(url);
    success('Exported', 'Saved summary as Markdown file.');
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <span>Structured Paper Summarizer</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Objective, section-by-section breakdown extracted strictly from paper contents
          </p>
        </div>

        {summary && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
              {copied ? <Check className="h-4 w-4 mr-1 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1" />}
              <span>Copy Markdown</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
              <Download className="h-4 w-4 mr-1" />
              <span>Export .md</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              isLoading={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate()}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span>Regenerate</span>
            </Button>
          </div>
        )}
      </div>

      {/* Document Selector Card */}
      <Card className="bg-white p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="text-xs font-semibold text-slate-700 shrink-0">
            Select Research Paper:
          </label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="flex-1 w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {completedDocs.length === 0 ? (
              <option value="">No completed papers available</option>
            ) : (
              completedDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.original_filename} ({d.page_count} pages)
                </option>
              ))
            )}
          </select>

          {selectedDocId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/app/documents/${selectedDocId}`)}
              className="text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> View in Reader
            </Button>
          )}
        </div>
      </Card>

      {/* Summary Viewport */}
      {summaryLoading || regenerateMutation.isPending ? (
        <div className="py-20 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Synthesizing paper structure...</p>
          <p className="text-xs text-slate-400">Extracting objectives, algorithms, benchmarks, and limitations.</p>
        </div>
      ) : !summary ? (
        <div className="py-20 text-center space-y-3">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No paper selected</p>
          <p className="text-xs text-slate-400">Choose a completed research document above to generate a summary.</p>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Paper Title Banner */}
          <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">Scientific Paper Summary</span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{summary.document_title}</h2>
            </div>
            <Badge variant="success">Evidence Verified</Badge>
          </div>

          {/* Structured Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(summary.sections).map(([key, section]) => {
              const isNotReported = !section.is_reported || section.content.includes('Not reported');

              return (
                <Card key={key} className={`bg-white ${isNotReported ? 'border-dashed opacity-80' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-slate-900">{section.title}</CardTitle>
                      {isNotReported ? (
                        <Badge variant="outline" className="text-[10px] text-slate-400">Not Reported</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">Extracted</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
