import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Edit2,
  Copy,
  Check,
  Quote,
  ExternalLink,
  Filter,
  AlertCircle,
  FileText,
  Bookmark,
  ChevronDown,
  Info,
  Loader2,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { Conversation, Message, Citation, Document } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';
import { formatDate } from '../lib/utils';

export const ResearchChatPage: React.FC = () => {
  const { id: routeConversationId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error, info } = useToast();

  const [activeConvId, setActiveConvId] = useState<string | null>(routeConversationId || null);
  const [inputText, setInputText] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [convToRename, setConvToRename] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync route param with active conversation
  useEffect(() => {
    if (routeConversationId) {
      setActiveConvId(routeConversationId);
    }
  }, [routeConversationId]);

  // Handle docId from query params
  const docIdParam = searchParams.get('docId');
  useEffect(() => {
    if (docIdParam && !selectedDocIds.includes(docIdParam)) {
      setSelectedDocIds([docIdParam]);
    }
  }, [docIdParam]);

  // Fetch all user conversations
  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations()
  });

  // Fetch all documents for filter selector
  const { data: documentsData } = useQuery({
    queryKey: ['documentsAll'],
    queryFn: () => api.getDocuments({ page_size: 100 })
  });
  const allDocuments: Document[] = documentsData?.items || [];

  // Fetch active conversation detail with messages
  const {
    data: activeConversation,
    isLoading: activeConvLoading,
    refetch: refetchActiveConv
  } = useQuery({
    queryKey: ['conversation', activeConvId],
    queryFn: () => (activeConvId ? api.getConversation(activeConvId) : null),
    enabled: !!activeConvId
  });

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Mutation: Create Conversation
  const createConvMutation = useMutation({
    mutationFn: (data?: { title?: string; selected_document_ids?: string[] }) =>
      api.createConversation(data),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConvId(newConv.id);
      navigate(`/app/chat/${newConv.id}`);
    }
  });

  // Mutation: Send Message
  const sendMessageMutation = useMutation({
    mutationFn: ({ convId, text, docIds }: { convId: string; text: string; docIds?: string[] }) =>
      api.sendMessage(convId, text, docIds),
    onSuccess: () => {
      refetchActiveConv();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
    },
    onError: (err: any) => {
      error('Failed to get answer', err.message);
    }
  });

  // Mutation: Delete Conversation
  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => {
      success('Conversation deleted');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (activeConvId) {
        setActiveConvId(null);
        navigate('/app/chat');
      }
    }
  });

  // Mutation: Rename Conversation
  const renameConvMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.updateConversation(id, { title }),
    onSuccess: () => {
      success('Conversation renamed');
      setRenameModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      refetchActiveConv();
    }
  });

  const handleStartNewChat = () => {
    createConvMutation.mutate({
      title: 'New Research Chat',
      selected_document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
    });
  };

  const submitQuestion = async (customQuestion?: string) => {
    const question = (customQuestion || inputText).trim();
    if (!question) return;

    setInputText('');

    if (!activeConvId) {
      try {
        const newConv = await api.createConversation({
          title: question.slice(0, 30) + '...',
          selected_document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
        });
        setActiveConvId(newConv.id);
        navigate(`/app/chat/${newConv.id}`);
        sendMessageMutation.mutate({
          convId: newConv.id,
          text: question,
          docIds: selectedDocIds.length > 0 ? selectedDocIds : undefined
        });
      } catch (err: any) {
        error('Chat error', err.message);
      }
    } else {
      sendMessageMutation.mutate({
        convId: activeConvId,
        text: question,
        docIds: selectedDocIds.length > 0 ? selectedDocIds : undefined
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestion();
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    success('Copied to clipboard');
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSaveAsNote = async (content: string, citations: Citation[]) => {
    const docId = citations.length > 0 ? citations[0].document_id : undefined;
    const title = 'Saved finding: ' + content.slice(0, 35) + '...';
    try {
      await api.createNote({
        title,
        content,
        document_id: docId,
        tags: ['Grounded QA', 'Synthesis']
      });
      success('Saved to Notes', 'Answer saved to your research notebook.');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (err: any) {
      error('Failed to save note', err.message);
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Conversations Drawer / Left Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-100">
          <Button
            onClick={handleStartNewChat}
            className="w-full text-xs font-semibold justify-center shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Research Chat
          </Button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Research History
          </p>

          {convsLoading ? (
            <div className="p-4 text-xs text-slate-400 text-center">Loading chats...</div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center">No conversations yet</div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConvId(c.id);
                    navigate(`/app/chat/${c.id}`);
                  }}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{c.title}</span>
                  </div>

                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvToRename(c);
                        setNewTitle(c.title);
                        setRenameModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Rename"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConvMutation.mutate(c.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Chat Header / Document Scope Filter */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {activeConversation?.title || 'Research Chat'}
            </h2>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <button
              onClick={() => setFilterModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <Filter className="h-3 w-3 text-indigo-600" />
              <span>
                {selectedDocIds.length === 0
                  ? 'All Documents (Global Search)'
                  : `${selectedDocIds.length} Selected Paper(s)`}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
              Grounded RAG Mode
            </Badge>
          </div>
        </div>

        {/* Messages Stream Viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {!activeConversation?.messages || activeConversation.messages.length === 0 ? (
            <div className="max-w-xl mx-auto my-16 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">What would you like to investigate?</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Ask specific questions about research methodologies, quantitative benchmarks, algorithms, or limitations. Answers will be backed by direct page-number citations.
              </p>

              {/* Starter Query Pills with 1-Click Submission */}
              <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg mx-auto">
                {[
                  'What BLEU scores did the Transformer achieve on translation benchmarks?',
                  'What is the error threshold of surface codes under depolarizing noise?',
                  'Why does the Transformer dispense with recurrence and convolutions?',
                  'What are the primary baseline models and datasets used?',
                  'What are the explicitly mentioned limitations of this approach?'
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => submitQuestion(sample)}
                    className="text-xs bg-white border border-indigo-200/80 hover:border-indigo-500 hover:bg-indigo-50/50 text-indigo-900 px-3 py-1.5 rounded-full transition-all text-left shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />
                    <span>&ldquo;{sample}&rdquo;</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${isAssistant ? 'mr-auto' : 'ml-auto justify-end'}`}
                >
                  {isAssistant && (
                    <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`space-y-3 ${isAssistant ? 'w-full' : 'max-w-xl'}`}>
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isAssistant
                          ? 'bg-white border border-slate-200/80 shadow-xs text-slate-800'
                          : 'bg-indigo-600 text-white shadow-xs rounded-br-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Footer Actions for Assistant */}
                      {isAssistant && (
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-400">
                          <div className="flex items-center gap-2 text-[11px]">
                            {msg.latency_ms && <span>{msg.latency_ms} ms</span>}
                            {msg.token_count && <span>&bull; {msg.token_count} tokens</span>}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="p-1 hover:text-slate-600 rounded cursor-pointer transition-colors"
                              title="Copy Answer"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleSaveAsNote(msg.content, msg.citations)}
                              className="p-1 hover:text-indigo-600 rounded cursor-pointer transition-colors"
                              title="Save Answer as Note"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Citations Panel */}
                    {isAssistant && msg.citations && msg.citations.length > 0 && (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                          <Quote className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Supporting Source Citations ({msg.citations.length})</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.citations.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => navigate(`/app/documents/${c.document_id}?page=${c.page_number}`)}
                              className="rounded-lg bg-white p-2.5 border border-indigo-100/80 hover:border-indigo-400 cursor-pointer transition-all shadow-2xs group"
                            >
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-800 truncate group-hover:text-indigo-600">
                                  {c.document_title}
                                </span>
                                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">
                                  Page {c.page_number}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed italic">
                                &ldquo;{c.excerpt}&rdquo;
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-600 font-medium">
                                <span>Inspect in Reader</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {sendMessageMutation.isPending && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Searching vector & keyword indices, grounding evidence, and generating response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask an evidence-based research question..."
              className="h-11 px-4 text-sm rounded-xl shadow-xs"
              disabled={sendMessageMutation.isPending}
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              disabled={!inputText.trim() || sendMessageMutation.isPending}
              className="rounded-xl px-5"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Filter Documents Dialog */}
      <Dialog
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Select Target Documents for Q&A"
        description="Choose which research papers to scope this conversation to. Leave unselected to query across your entire library."
      >
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {allDocuments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No documents in library.</p>
          ) : (
            allDocuments.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => toggleDocSelection(doc.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="truncate">{doc.original_filename}</span>
                  </div>
                  <Badge variant={doc.status === 'completed' ? 'success' : 'default'}>
                    {doc.status}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDocIds([])}
          >
            Clear Selection (Search All)
          </Button>
          <Button
            size="sm"
            onClick={() => setFilterModalOpen(false)}
          >
            Apply Scope
          </Button>
        </div>
      </Dialog>

      {/* Rename Conversation Dialog */}
      <Dialog
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename Conversation"
      >
        <div className="space-y-4">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Conversation title"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (convToRename && newTitle.trim()) {
                  renameConvMutation.mutate({ id: convToRename.id, title: newTitle.trim() });
                }
              }}
            >
              Save Title
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
