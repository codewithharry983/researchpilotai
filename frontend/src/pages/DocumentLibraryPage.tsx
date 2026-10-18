import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Document, DocumentDetail } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';
import { formatBytes, formatDate } from '../lib/utils';

export const DocumentLibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error, info } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [uploadModalOpen, setUploadModalOpen] = useState(searchParams.get('action') === 'upload');
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DocumentDetail | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setUploadModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Query documents list
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', searchQuery, statusFilter, page],
    queryFn: () => api.getDocuments({ query: searchQuery || undefined, status: statusFilter || undefined, page, page_size: 10 }),
    refetchInterval: (query) => {
      // If any document is queued or processing, poll every 3s
      const hasPending = query.state.data?.items.some((d: Document) => d.status === 'queued' || d.status === 'processing');
      return hasPending ? 3000 : false;
    }
  });

  // Reprocess Mutation
  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.reprocessDocument(id),
    onSuccess: () => {
      success('Processing re-queued', 'Document has been re-submitted for text extraction and indexing.');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => {
      error('Reprocess failed', err.message);
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      success('Document deleted', 'The document and its vector embeddings have been removed.');
      setDocToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
    },
    onError: (err: any) => {
      error('Delete failed', err.message);
    }
  });

  // Upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        error('Invalid File Type', `${file.name} is not a PDF.`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        error('File Too Large', `${file.name} exceeds the 25MB limit.`);
        continue;
      }

      setUploadingFiles((prev) => [...prev, { name: file.name, progress: 20 }]);
      try {
        await api.uploadDocument(file);
        success('Document Uploaded', `${file.name} has been queued for processing.`);
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
      } catch (err: any) {
        error('Upload Failed', err.message || `Failed to upload ${file.name}`);
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    }
    setUploadModalOpen(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const openDocDetail = async (doc: Document) => {
    try {
      const detail = await api.getDocument(doc.id);
      setSelectedDocForDetail(detail);
    } catch {
      setSelectedDocForDetail({ ...doc, chunk_count: 0 });
    }
  };

  // Seed Samples Mutation
  const seedMutation = useMutation({
    mutationFn: () => api.seedSamplePapers(),
    onSuccess: () => {
      success('Sample Papers Loaded', 'Loaded Attention Is All You Need and Fault-Tolerant Surface Codes into your workspace!');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
    },
    onError: (err: any) => error('Seed failed', err.message)
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Document Library</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Manage your research papers, inspect processing status, and launch readers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            isLoading={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2 text-indigo-600" /> Load Sample Papers
          </Button>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload Papers
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search documents by paper title or filename..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Uploading Status Banner */}
      {uploadingFiles.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-2">
          {uploadingFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-medium text-indigo-900 truncate">{f.name}</span>
              <span className="text-indigo-600 font-semibold">Uploading to secure storage...</span>
            </div>
          ))}
        </div>
      )}

      {/* Documents Table */}
      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Document Title</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Pages</th>
                <th className="px-4 py-3.5">File Size</th>
                <th className="px-4 py-3.5">Uploaded</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Loading research documents...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No documents found</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      {searchQuery || statusFilter ? 'Try clearing your search filters' : 'Upload your first research paper to get started'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={seedMutation.isPending}
                        onClick={() => seedMutation.mutate()}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1 text-indigo-600" /> Load Sample Papers
                      </Button>
                      <Button size="sm" onClick={() => setUploadModalOpen(true)}>
                        <Upload className="h-4 w-4 mr-1" /> Upload PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((doc) => {
                  const badgeVariant =
                    doc.status === 'completed' ? 'success' : doc.status === 'processing' ? 'warning' : doc.status === 'failed' ? 'destructive' : 'default';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 max-w-md">
                            <p
                              onClick={() => navigate(`/app/documents/${doc.id}`)}
                              className="font-medium text-slate-900 truncate hover:text-indigo-600 cursor-pointer"
                              title={doc.original_filename}
                            >
                              {doc.original_filename}
                            </p>
                            {doc.error_message && (
                              <p className="text-xs text-rose-600 truncate mt-0.5" title={doc.error_message}>
                                {doc.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <Badge variant={badgeVariant as any}>{doc.status}</Badge>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        {doc.page_count > 0 ? doc.page_count : '—'}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-600">
                        {formatBytes(doc.file_size)}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatDate(doc.created_at)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Open Reader & Citations"
                            onClick={() => navigate(`/app/documents/${doc.id}`)}
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Inspect Details"
                            onClick={() => openDocDetail(doc)}
                          >
                            <FileCheck2 className="h-4 w-4 text-slate-600" />
                          </Button>

                          {doc.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reprocess Document"
                              onClick={() => reprocessMutation.mutate(doc.id)}
                            >
                              <RefreshCw className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Document"
                            onClick={() => setDocToDelete(doc)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500 hover:text-rose-700" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total > 10 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.total)} of {data.total} documents
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 10 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      <Dialog
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Research Papers"
        description="Select PDF files from your device or drag them into the upload zone (max 25MB each)."
      >
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Click or drag & drop PDFs here</p>
          <p className="text-xs text-slate-500 mt-1">Supports academic papers, technical reports, and research preprints</p>
        </div>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        isOpen={!!selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
        title="Document Metadata & Ingestion Details"
        maxWidth="lg"
      >
        {selectedDocForDetail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-400 block font-medium">Original Filename:</span>
                <span className="font-semibold text-slate-800 break-words">{selectedDocForDetail.original_filename}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Status:</span>
                <Badge variant={selectedDocForDetail.status === 'completed' ? 'success' : 'default'}>
                  {selectedDocForDetail.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Page Count:</span>
                <span className="font-semibold text-slate-800">{selectedDocForDetail.page_count}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Indexed Chunks:</span>
                <span className="font-semibold text-slate-800">{selectedDocForDetail.chunk_count}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">File Size:</span>
                <span className="font-semibold text-slate-800">{formatBytes(selectedDocForDetail.file_size)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Upload Date:</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedDocForDetail.created_at)}</span>
              </div>
            </div>

            {selectedDocForDetail.error_message && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                <span className="font-bold block mb-1">Ingestion Message:</span>
                {selectedDocForDetail.error_message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  navigate(`/app/documents/${selectedDocForDetail.id}`);
                  setSelectedDocForDetail(null);
                }}
              >
                Open Reader <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        title="Delete Document"
        description="Are you sure you want to permanently delete this paper? All indexed vector embeddings and citations derived from this document will be removed."
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setDocToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            isLoading={deleteMutation.isPending}
            onClick={() => docToDelete && deleteMutation.mutate(docToDelete.id)}
          >
            Permanently Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
