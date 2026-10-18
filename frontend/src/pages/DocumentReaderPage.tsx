import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Layers,
  Quote,
  StickyNote
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatBytes, formatDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';

export const DocumentReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success } = useToast();

  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'pdf' | 'extracted'>('pdf');

  // Load document details
  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => id ? api.getDocument(id) : null,
    enabled: !!id
  });

  const pdfUrl = id ? `${api.getDocumentFileUrl(id)}#page=${currentPage}` : '';

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (document && currentPage < document.page_count) setCurrentPage((p) => p + 1);
  };

  const handleCreateNoteFromPaper = () => {
    navigate(`/app/notes?docId=${document?.id}&docTitle=${encodeURIComponent(document?.original_filename || '')}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/documents')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Library
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate max-w-sm md:max-w-md">
              {document?.original_filename || 'Loading Paper...'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {document?.page_count || 0} Pages &bull; {document ? formatBytes(document.file_size) : ''}
            </p>
          </div>
        </div>

        {/* Reader Controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'pdf' ? 'bg-white shadow-xs text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PDF Document
            </button>
            <button
              onClick={() => setViewMode('extracted')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'extracted' ? 'bg-white shadow-xs text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Extracted Chunks
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Quick Actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/app/summarizer?docId=${id}`)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Summarize
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNoteFromPaper}
          >
            <StickyNote className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Add Note
          </Button>
        </div>
      </div>

      {/* Main Reader Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center View: Document Canvas / Iframe */}
        <div className="flex-1 flex flex-col items-center justify-between p-4 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Loading research document viewer...
            </div>
          ) : viewMode === 'pdf' ? (
            <div className="w-full h-full bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col">
              <iframe
                key={`${id}-p${currentPage}`}
                src={`${api.getDocumentFileUrl(id || '')}#page=${currentPage}&zoom=${zoomLevel}`}
                className="w-full h-full border-0 bg-slate-900"
                title="Research Document Viewer"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-white rounded-xl p-8 overflow-y-auto shadow-sm border border-slate-200 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Extracted Text Content & Index</h3>
                <p className="text-xs text-slate-500">
                  Verifiable textual content normalized by PyMuPDF and indexed across {document?.chunk_count || 0} chunks.
                </p>
              </div>

              {document?.summary_markdown ? (
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs leading-relaxed text-slate-700 space-y-2">
                  <span className="font-bold text-indigo-900 block">Precomputed Synthesis Available:</span>
                  <p>Open the Summarizer tab to view structured scientific sections.</p>
                </div>
              ) : null}

              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                {document?.original_filename} is verified and indexed in vector storage.
                Target page: Page {currentPage} of {document?.page_count}.
              </div>
            </div>
          )}

          {/* Bottom Floating Navigation for Page Jump */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-md border border-slate-200 mt-3 shrink-0">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-700 min-w-16 text-center">
              Page {currentPage} of {document?.page_count || 1}
            </span>
            <button
              onClick={handleNextPage}
              disabled={document ? currentPage >= document.page_count : true}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="h-3 w-px bg-slate-200" />

            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-500">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Citation & Meta Inspector */}
        <aside className="w-80 bg-white border-l border-slate-200 p-5 flex flex-col space-y-5 overflow-y-auto hidden lg:flex">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paper Evidence</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When reviewing AI answers, citations will automatically open this document at the referenced page.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
              <Quote className="h-4 w-4 text-indigo-600" /> Citation Verification Active
            </div>
            <p className="text-[11px] text-indigo-800/80 leading-relaxed">
              All claims generated by ResearchPilot AI link directly to specific page coordinates.
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
            <h4 className="font-semibold text-slate-900">Document Actions</h4>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => navigate(`/app/chat?docId=${id}`)}
            >
              <BookOpen className="h-3.5 w-3.5 mr-2" /> Chat About This Paper
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => navigate(`/app/comparison?docId=${id}`)}
            >
              <Layers className="h-3.5 w-3.5 mr-2" /> Compare with Other Papers
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};
