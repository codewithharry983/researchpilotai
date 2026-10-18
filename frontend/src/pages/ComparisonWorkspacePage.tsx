import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Scale,
  FileText,
  Copy,
  Download,
  Check,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { Document, CompareResponse, ComparisonMatrixRow } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export const ComparisonWorkspacePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Initialize with docId from query params if available
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId && !selectedIds.includes(docId)) {
      setSelectedIds([docId]);
    }
  }, [searchParams]);

  // Load completed documents
  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documentsCompletedForCompare'],
    queryFn: () => api.getDocuments({ status: 'completed', page_size: 50 })
  });
  const completedDocs: Document[] = documentsData?.items || [];

  // Compare Mutation
  const compareMutation = useMutation({
    mutationFn: (ids: string[]) => api.compareDocuments(ids),
    onSuccess: () => {
      success('Comparison Generated', 'Cross-paper matrix synthesized.');
    },
    onError: (err: any) => {
      error('Comparison Failed', err.message);
    }
  });

  const toggleSelectDoc = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 4) {
        error('Limit reached', 'You can compare up to 4 research papers simultaneously.');
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRunComparison = () => {
    if (selectedIds.length < 2) {
      error('Selection required', 'Please select at least 2 research papers to compare.');
      return;
    }
    compareMutation.mutate(selectedIds);
  };

  const handleCopyMarkdown = () => {
    if (!compareMutation.data) return;
    const res = compareMutation.data;
    const docTitles = res.document_ids.map((id) => res.document_titles[id] || id);
    const header = `| Dimension | ${docTitles.join(' | ')} |\n| --- | ${docTitles.map(() => '---').join(' | ')} |\n`;
    const rows = res.matrix
      .map((r) => `| **${r.criterion}** | ${res.document_ids.map((id) => r.documents[id] || 'N/A').join(' | ')} |`)
      .join('\n');
    const full = `# Research Paper Comparison\n\n${header}${rows}\n\n## Comparative Synthesis\n${res.synthesis_markdown}`;

    navigator.clipboard.writeText(full);
    setCopied(true);
    success('Copied comparison markdown');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Scale className="h-6 w-6 text-indigo-600" />
            <span>Multi-Paper Comparison Workspace</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Compare scientific contributions, experimental setups, and trade-offs side by side
          </p>
        </div>

        {compareMutation.data && (
          <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
            {copied ? <Check className="h-4 w-4 mr-1 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1" />}
            <span>Copy Markdown</span>
          </Button>
        )}
      </div>

      {/* Document Selection Matrix Checklist */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Select 2 to 4 Research Papers to Compare ({selectedIds.length} selected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="text-xs text-slate-400 py-4 text-center">Loading papers...</div>
          ) : completedDocs.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              No completed papers found. Please upload at least 2 papers first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {completedDocs.map((doc) => {
                const isSelected = selectedIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => toggleSelectDoc(doc.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs font-semibold'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{doc.original_filename}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-indigo-600 shrink-0 ml-1.5" />}
                  </div>
                );
              })}
            </div>
          )}

          {completedDocs.length >= 2 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setSelectedIds(completedDocs.slice(0, 2).map((d) => d.id))}
                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" /> Select Both Landmark Papers (1-Click)
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4 mt-2">
            <Button
              disabled={selectedIds.length < 2 || compareMutation.isPending}
              isLoading={compareMutation.isPending}
              onClick={handleRunComparison}
            >
              <Scale className="h-4 w-4 mr-2" />
              Compare Selected Papers ({selectedIds.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {compareMutation.isPending && (
        <div className="py-20 text-center space-y-3">
          <Scale className="h-8 w-8 text-indigo-600 animate-pulse mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Synthesizing comparative matrix...</p>
          <p className="text-xs text-slate-400">Aligning benchmark datasets, methodologies, and findings.</p>
        </div>
      )}

      {compareMutation.data && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Comparative Table */}
          <Card className="bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] w-48 shrink-0">
                      Research Dimension
                    </th>
                    {compareMutation.data.document_ids.map((docId) => (
                      <th key={docId} className="px-5 py-3.5 font-bold text-slate-900">
                        {compareMutation.data.document_titles[docId] || docId}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compareMutation.data.matrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-semibold text-slate-800 bg-slate-50/30 align-top">
                        {row.criterion}
                      </td>
                      {compareMutation.data.document_ids.map((docId) => {
                        const val = row.documents[docId] || 'Not reported';
                        const isNotReported = val.includes('Not reported') || val === 'N/A';
                        return (
                          <td key={docId} className="px-5 py-4 text-slate-600 leading-relaxed align-top">
                            {isNotReported ? (
                              <span className="text-slate-400 italic">Not reported in paper</span>
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Comparative Synthesis Narrative */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <span>Objective Comparative Synthesis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {compareMutation.data.synthesis_markdown}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
