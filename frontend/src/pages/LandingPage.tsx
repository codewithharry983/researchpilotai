import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  FileCheck2,
  Search,
  Sparkles,
  Scale,
  ShieldCheck,
  ArrowRight,
  Database,
  Quote,
  CheckCircle,
  AlertTriangle,
  Radio,
  Play,
  Pause,
  ExternalLink,
  BookOpen,
  Volume2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const LandingPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);
  const [activeInteractiveDemo, setActiveInteractiveDemo] = useState<'rag' | 'uncertainty' | 'podcast' | 'matrix'>('rag');

  const handleInstantDemo = async () => {
    const demoEmail = 'demo@researchpilot.ai';
    const demoPass = 'ResearchPilot2026!';
    try {
      setDemoLoading(true);
      try {
        await login(demoEmail, demoPass);
      } catch {
        await register(demoEmail, demoPass, 'Dr. Alex Mercer (Lead Researcher)');
        try {
          await api.seedSamplePapers();
        } catch {}
      }
      navigate('/app/dashboard');
    } catch {
      navigate('/login');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Compass className="h-5 w-5" />
            </div>
            <span>ResearchPilot<span className="text-indigo-600">AI</span></span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstantDemo}
              isLoading={demoLoading}
              className="border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 font-semibold hidden sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-600" /> Instant Demo
            </Button>
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-20 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="h-3.5 w-3.5" /> Next-Gen Evidence-Grounded Research Assistant
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-6">
          Research with absolute <span className="text-indigo-600 underline decoration-indigo-300 underline-offset-4">evidentiary rigor</span>.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
          Upload scientific papers, ask complex domain questions, generate multi-speaker audio podcasts, and receive syntheses verified with direct page-number citations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={handleInstantDemo}
            isLoading={demoLoading}
            className="w-full sm:w-auto shadow-lg shadow-indigo-600/25 text-base font-bold px-8 py-3.5"
          >
            <Sparkles className="h-5 w-5 mr-2" /> Launch Live Interactive Workspace
          </Button>
          <Link to="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full text-base">
              Sign In to Your Library
            </Button>
          </Link>
        </div>

        {/* Live Interactive Simulator Pill Selector */}
        <div className="mt-12 max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-left animate-in fade-in duration-300">
          <div className="flex border-b border-slate-100 bg-slate-50/70 p-2 gap-1.5 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'rag', label: '1. Grounded Citations', icon: Quote },
              { id: 'uncertainty', label: '2. Honest Uncertainty', icon: AlertTriangle },
              { id: 'podcast', label: '3. AI Podcast Studio', icon: Radio },
              { id: 'matrix', label: '4. Paper Comparison', icon: Scale },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isSelected = activeInteractiveDemo === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveInteractiveDemo(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-indigo-700 font-bold shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <IconComp className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {activeInteractiveDemo === 'rag' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">User Query:</span>
                  <Badge variant="outline">Grounded RAG Mode &bull; Page Verified</Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs font-medium text-slate-800 border border-slate-100">
                  &ldquo;What BLEU scores did the Transformer achieve on translation benchmarks?&rdquo;
                </div>
                <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                  <p className="text-xs text-slate-800 leading-relaxed">
                    Based on the provided research documents, on the WMT 2014 English-to-German translation task, the Transformer achieves a state-of-the-art BLEU score of <strong>28.4</strong>, outperforming previous models by more than 2.0 BLEU. On English-to-French, it achieved <strong>41.0</strong> after 3.5 days of training.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Verified Citation:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                      <Quote className="h-3 w-3" /> Attention Is All You Need &bull; Page 4
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeInteractiveDemo === 'uncertainty' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">Unanswerable Query Test:</span>
                  <Badge variant="warning">Zero Hallucination Protocol Active</Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs font-medium text-slate-800 border border-slate-100">
                  &ldquo;What were the phase III clinical trial efficacy rates of the mRNA-1273 vaccine?&rdquo;
                </div>
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Insufficient Evidence Reported
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Based on the uploaded research documents, there is insufficient evidence to answer this question. The current knowledge base contains papers on deep learning architectures and quantum surface codes, but no clinical trial data.
                  </p>
                </div>
              </div>
            )}

            {activeInteractiveDemo === 'podcast' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">AI Podcast Studio Dialogue:</span>
                  <Badge variant="success">Multi-Speaker Neural TTS (Alex & Taylor)</Badge>
                </div>
                <div className="space-y-2.5">
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      A
                    </div>
                    <div className="text-xs text-slate-800">
                      <strong className="text-indigo-900">Alex (Host 1):</strong> &ldquo;Taylor, what is truly radical about the Transformer is abandoning recurrence altogether in favor of self-attention.&rdquo;
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      T
                    </div>
                    <div className="text-xs text-slate-800">
                      <strong className="text-emerald-900">Taylor (Host 2):</strong> &ldquo;Exactly! That reduces the sequential training operations from O(n) to O(1), allowing massive GPU parallelization.&rdquo;
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeInteractiveDemo === 'matrix' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">Cross-Paper Comparative Dimension:</span>
                  <Badge variant="outline">2 Papers Selected</Badge>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="p-2 text-left font-bold border border-slate-200">Dimension</th>
                        <th className="p-2 text-left font-bold border border-slate-200">Attention Is All You Need</th>
                        <th className="p-2 text-left font-bold border border-slate-200">Surface Codes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 font-semibold bg-slate-50 border border-slate-200">Core Problem</td>
                        <td className="p-2 border border-slate-200">Sequential bottlenecks in RNNs</td>
                        <td className="p-2 border border-slate-200">Decoherence in physical qubits</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-semibold bg-slate-50 border border-slate-200">Primary Metric</td>
                        <td className="p-2 border border-slate-200">28.4 BLEU (WMT En-De)</td>
                        <td className="p-2 border border-slate-200">1.0% Fault-tolerant threshold</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="py-16 px-6 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-3">
              Engineered specifically for researchers who cannot afford errors.
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              Unlike generic conversational chatbots, ResearchPilot AI implements strict retrieval verification and grounding constraints.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Quote className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Verifiable Source Citations</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every generated answer links directly to its source paper and exact page number. Inspect source excerpts and verify original text side-by-side.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Honest Uncertainty Protocol</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When documents lack sufficient evidence, the model explicitly acknowledges the absence of information rather than inventing believable falsehoods.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Podcast Studio</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Transform complex papers and YouTube lectures into engaging two-host audio discussions, complete with speed controls and study notes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 text-center text-xs text-slate-500 bg-white">
        <p>&copy; {new Date().getFullYear()} ResearchPilot AI &bull; Intelligent Evidence-Grounded Research Assistant</p>
      </footer>
    </div>
  );
};
