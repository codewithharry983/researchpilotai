import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  MessageSquare,
  Sparkles,
  Scale,
  Upload,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Cpu,
  BookOpen,
  Radio,
  Search,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatBytes, formatDate } from '../lib/utils';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Queries for real backend data
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usageSummary'],
    queryFn: () => api.getUsageSummary(),
    refetchInterval: 10000 // refresh every 10s
  });

  const { data: docList, isLoading: docsLoading } = useQuery({
    queryKey: ['recentDocuments'],
    queryFn: () => api.getDocuments({ page: 1, page_size: 5 })
  });

  const { data: convList, isLoading: convsLoading } = useQuery({
    queryKey: ['recentConversations'],
    queryFn: () => api.getConversations()
  });

  const handleStartChat = async () => {
    try {
      const conv = await api.createConversation({ title: 'New Research Chat' });
      navigate(`/app/chat/${conv.id}`);
    } catch {
      navigate('/app/chat');
    }
  };

  const [quickQuery, setQuickQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  const handleQuickQuery = async (queryText?: string) => {
    const q = (queryText || quickQuery).trim();
    if (!q) return;
    try {
      setIsQuerying(true);
      const conv = await api.createConversation({ title: q.slice(0, 30) + '...' });
      await api.sendMessage(conv.id, q);
      navigate(`/app/chat/${conv.id}`);
    } catch {
      navigate('/app/chat');
    } finally {
      setIsQuerying(false);
    }
  };

  const seedMutation = useMutation({
    mutationFn: () => api.seedSamplePapers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['usageSummary'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {user?.full_name ? user.full_name : 'Researcher'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Research workspace & evidentiary knowledge base &bull; {user?.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            isLoading={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
          >
            <CheckCircle2 className="h-4 w-4 mr-2 text-indigo-600" /> Load Demo Papers
          </Button>
          <Button onClick={() => navigate('/app/documents?action=upload')}>
            <Upload className="h-4 w-4 mr-2" /> Upload Document
          </Button>
          <Button variant="outline" onClick={handleStartChat}>
            <MessageSquare className="h-4 w-4 mr-2" /> New Research Chat
          </Button>
        </div>
      </div>

      {/* Interactive Research Command Bar */}
      <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-300" />
            <h2 className="text-sm md:text-base font-bold text-white">Ask Anything Across Your Scientific Library</h2>
          </div>
          <Badge variant="outline" className="text-[10px] bg-indigo-800/60 border-indigo-500/40 text-indigo-200 hidden sm:inline-flex">
            Hybrid Vector + Keyword Search
          </Badge>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuickQuery();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Ask a question (e.g. 'What BLEU scores were reported on WMT14?')..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 focus:bg-white text-slate-100 focus:text-slate-900 text-xs md:text-sm placeholder:text-slate-300 focus:placeholder:text-slate-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
            />
          </div>
          <Button
            type="submit"
            isLoading={isQuerying}
            className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold shrink-0 shadow-md text-xs md:text-sm"
          >
            Ask AI <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-indigo-200">
          <span className="text-[11px] font-semibold text-indigo-300 shrink-0">Try Asking:</span>
          {[
            'What BLEU scores did the Transformer achieve?',
            'What is the threshold for surface codes?',
            'Why does the Transformer dispense with recurrence?',
          ].map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickQuery(sample)}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-medium text-white transition-all cursor-pointer"
            >
              &ldquo;{sample}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Documents
            </CardTitle>
            <FileText className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {usageLoading ? '...' : (usage?.total_documents ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {usage?.completed_documents ?? 0} indexed &bull; {usage?.failed_documents ?? 0} errors
            </p>
          </CardContent>
        </Card>

        {/* Indexed Chunks */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Processed Papers
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {usageLoading ? '...' : (usage?.completed_documents ?? 0)}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center">
              100% Vector & Keyword Ready
            </p>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {usageLoading ? '...' : (usage?.total_conversations ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {usage?.total_messages ?? 0} total questions answered
            </p>
          </CardContent>
        </Card>

        {/* Research Notes */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Saved Notes
            </CardTitle>
            <BookOpen className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {usageLoading ? '...' : (usage?.total_notes ?? 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Structured research findings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Research Workflows</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div
            onClick={handleStartChat}
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <MessageSquare className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">Grounded AI Chat</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Ask deep questions across your documents with page-number source citations and zero hallucination.
            </p>
          </div>

          <div
            onClick={() => navigate('/app/summarizer')}
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Sparkles className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">Structured Paper Summarizer</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Generate structured breakdowns of research problems, methods, datasets, models, metrics, and limitations.
            </p>
          </div>

          <div
            onClick={() => navigate('/app/comparison')}
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Scale className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">Multi-Paper Comparison</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Synthesize 2 or more research papers in a comparative matrix highlighting distinct experimental setups.
            </p>
          </div>

          <div
            onClick={() => navigate('/app/studio')}
            className="group cursor-pointer rounded-2xl border border-indigo-200 bg-indigo-50/30 p-6 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-indigo-500 group-hover:text-indigo-700" />
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">AI Podcast Studio</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Generate natural multi-speaker audio podcasts, summaries, and smart study notes from papers & YouTube videos.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Documents & Recent Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Recent Documents</CardTitle>
              <CardDescription className="text-xs">Your most recently uploaded research papers</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/documents')}>
              View Library &rarr;
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {docsLoading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading documents...</div>
            ) : !docList?.items || docList.items.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No documents yet</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">Upload your first research paper to get started</p>
                <Button size="sm" onClick={() => navigate('/app/documents?action=upload')}>
                  Upload PDF
                </Button>
              </div>
            ) : (
              docList.items.map((doc) => {
                const badgeVariant =
                  doc.status === 'completed' ? 'success' : doc.status === 'processing' ? 'warning' : doc.status === 'failed' ? 'destructive' : 'default';

                return (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/app/documents/${doc.id}`)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.original_filename}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} &bull; {formatBytes(doc.file_size)} &bull; {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Badge variant={badgeVariant as any}>
                        {doc.status}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
              <CardDescription className="text-xs">Active Q&A research threads</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/chat')}>
              View All &rarr;
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {convsLoading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading chats...</div>
            ) : !convList || convList.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No active conversations</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">Start a chat to ask questions grounded in your papers</p>
                <Button size="sm" onClick={handleStartChat}>
                  Start Chat
                </Button>
              </div>
            ) : (
              convList.slice(0, 5).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/app/chat/${conv.id}`)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{conv.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'} &bull; Updated {formatDate(conv.updated_at)}
                      </p>
                    </div>
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
