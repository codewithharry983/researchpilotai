import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StickyNote,
  Plus,
  Search,
  Trash2,
  Edit3,
  Download,
  Tag,
  FileText,
  Bookmark,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { ResearchNote, Document } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';
import { formatDate } from '../lib/utils';

export const SavedNotesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ResearchNote | null>(null);

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDocId, setNoteDocId] = useState<string>(searchParams.get('docId') || '');
  const [noteTags, setNoteTags] = useState('');

  // Handle docId from query params
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId) {
      setNoteDocId(docId);
      setNoteTitle(`Notes on ${searchParams.get('docTitle') || 'Paper'}`);
      setEditorModalOpen(true);
    }
  }, [searchParams]);

  // Query notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', searchQuery],
    queryFn: () => api.getNotes({ query: searchQuery || undefined })
  });

  // Query documents for dropdown
  const { data: documentsData } = useQuery({
    queryKey: ['documentsDropdown'],
    queryFn: () => api.getDocuments({ page_size: 100 })
  });
  const allDocuments: Document[] = documentsData?.items || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; document_id?: string; tags?: string[] }) =>
      api.createNote(data),
    onSuccess: () => {
      success('Note created');
      setEditorModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
    },
    onError: (err: any) => error('Create failed', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; tags?: string[] } }) =>
      api.updateNote(id, data),
    onSuccess: () => {
      success('Note updated');
      setEditorModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err: any) => error('Update failed', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => {
      success('Note deleted');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
    },
    onError: (err: any) => error('Delete failed', err.message)
  });

  const resetForm = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteDocId('');
    setNoteTags('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditorModalOpen(true);
  };

  const handleOpenEdit = (note: ResearchNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteDocId(note.document_id || '');
    setNoteTags((note.tags || []).join(', '));
    setEditorModalOpen(true);
  };

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) {
      error('Validation', 'Title and content are required.');
      return;
    }

    const tagsArray = noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        data: {
          title: noteTitle.trim(),
          content: noteContent.trim(),
          tags: tagsArray
        }
      });
    } else {
      createMutation.mutate({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        document_id: noteDocId || undefined,
        tags: tagsArray
      });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <StickyNote className="h-6 w-6 text-indigo-600" />
            <span>Research Workspace Notes</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Organize synthesis notes, saved AI responses, and citations linked to papers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.getNotesExportUrl()}
            download="research_notes.md"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export All (.md)
          </a>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> New Note
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search research notes by keyword or paper title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading research notes...</div>
      ) : !notes || notes.length === 0 ? (
        <div className="py-20 text-center">
          <StickyNote className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No notes yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Save answers from Research Chat or jot down insights directly.
          </p>
          <Button size="sm" onClick={handleOpenCreate}>
            Create First Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {notes.map((note) => (
            <Card key={note.id} className="bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                    {note.title}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(note)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      title="Edit Note"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(note.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Delete Note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {note.document_title && (
                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 font-medium mt-1">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{note.document_title}</span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {note.content}
                </p>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                    {note.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 pt-1">
                  Updated {formatDate(note.updated_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Note Editor Modal */}
      <Dialog
        isOpen={editorModalOpen}
        onClose={() => setEditorModalOpen(false)}
        title={editingNote ? 'Edit Research Note' : 'Create Research Note'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitNote} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Note Title</label>
            <Input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g. Summary of Section 4 Findings"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Associated Paper (Optional)</label>
            <select
              value={noteDocId}
              onChange={(e) => setNoteDocId(e.target.value)}
              disabled={!!editingNote}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 shadow-xs focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No paper association</option>
              {allDocuments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.original_filename}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Note Content (Markdown supported)</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Record synthesis findings, quotes, or equations..."
              rows={8}
              required
              className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-800 leading-relaxed font-sans shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Tags (comma-separated)</label>
            <Input
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="e.g. Methodology, Transformer, Benchmark"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setEditorModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
