import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Settings,
  User,
  Cpu,
  Sliders,
  Activity,
  CheckCircle2,
  HardDrive,
  BarChart3,
  ShieldCheck,
  Server
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { formatDate } from '../lib/utils';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [newPassword, setNewPassword] = useState('');

  // Usage summary query
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['settingsUsage'],
    queryFn: () => api.getUsageSummary()
  });

  // Health check query
  const { data: health } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => api.getHealth()
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: (data: { full_name?: string; password?: string }) => api.updateMe(data),
    onSuccess: () => {
      success('Profile updated', 'Your account settings have been saved.');
      setNewPassword('');
      refreshUser();
    },
    onError: (err: any) => error('Update failed', err.message)
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({
      full_name: fullName.trim() || undefined,
      password: newPassword ? newPassword : undefined
    });
  };

  // Prepare chart data from token_usage_by_model
  const chartData = usage?.token_usage_by_model
    ? Object.entries(usage.token_usage_by_model).map(([model, tokens]) => ({
        model,
        tokens
      }))
    : [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          <span>Settings & Usage Telemetry</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Manage your account credentials, view model provider settings, and monitor token consumption
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Settings & AI Provider Info */}
        <div className="space-y-6 lg:col-span-1">
          {/* Account Profile Card */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                <span>Account Profile</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <Input value={user?.email || ''} disabled className="bg-slate-50 text-slate-500" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Full Name</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Jordan Hayes"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Change Password (optional)</label>
                  <Input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" size="sm" className="w-full" isLoading={profileMutation.isPending}>
                  Save Settings
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* System & Model Provider Card */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-indigo-600" />
                <span>Provider Configuration</span>
              </CardTitle>
              <CardDescription className="text-xs">Active server-side engine parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">LLM Provider</span>
                <Badge variant="default">{health?.checks?.llm_provider || 'OpenAI / Gemini / Offline'}</Badge>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Embedding Engine</span>
                <Badge variant="default">{health?.checks?.embedding_provider || 'Dense Vector (384d)'}</Badge>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Database Driver</span>
                <span className="font-semibold text-slate-700">{health?.checks?.database_driver || 'PostgreSQL / SQLite'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Retrieval Ranking</span>
                <span className="font-semibold text-slate-700">RRF (Vector + Lexical)</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Storage Backend</span>
                <span className="font-semibold text-slate-700">Local Isolated Sandbox</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Analytics, Token Usage & Activity */}
        <div className="space-y-6 lg:col-span-2">
          {/* Aggregate Telemetry Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Total Tokens</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {usage?.total_tokens?.toLocaleString() || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Questions</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {usage?.total_queries || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Mean Latency</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {usage?.avg_latency_ms || 0} ms
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Est. Cost (USD)</span>
              <span className="text-xl font-bold text-emerald-600 mt-1 block">
                ${usage?.estimated_cost_usd?.toFixed(4) || '0.0000'}
              </span>
            </div>
          </div>

          {/* Token Usage Chart */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                <span>Token Usage by Model</span>
              </CardTitle>
              <CardDescription className="text-xs">Breakdown of prompt & completion tokens consumed</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  No model token telemetry recorded yet. Ask a question to view usage statistics.
                </div>
              ) : (
                <div className="h-48 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="tokens" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Telemetry Activity */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                <span>Recent Query Execution Log</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0 text-xs">
              {!usage?.recent_activity || usage.recent_activity.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No activity recorded yet</div>
              ) : (
                usage.recent_activity.map((act) => (
                  <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{act.endpoint}</span>
                        <Badge variant="outline" className="text-[10px]">{act.model}</Badge>
                      </div>
                      <span className="text-[10px] text-slate-400">{formatDate(act.timestamp)}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-slate-700">{act.total_tokens} tokens</span>
                      <span className="text-[10px] text-slate-400 block">{act.latency_ms} ms</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
