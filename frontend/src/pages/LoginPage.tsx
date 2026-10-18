import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleDemoLogin = async () => {
    const demoEmail = 'demo@researchpilot.ai';
    const demoPassword = 'ResearchPilot2026!';
    try {
      setLoading(true);
      try {
        await login(demoEmail, demoPassword);
      } catch {
        // Auto-register demo account if not exists
        await register(demoEmail, demoPassword, 'Dr. Alex Mercer (Lead Researcher)');
        try {
          await api.seedSamplePapers();
        } catch {
          // ignore if already seeded
        }
      }
      success('Welcome to ResearchPilot AI!', 'Signed in with demo researcher credentials.');
      navigate('/app/dashboard');
    } catch (err: any) {
      error('Demo sign-in failed', err.message || 'Could not authenticate demo user.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      error('Validation error', 'Please provide both your email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      success('Welcome back!', 'Successfully signed in to your research workspace.');
      navigate('/app/dashboard');
    } catch (err: any) {
      error('Authentication failed', err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Link to="/" className="flex items-center gap-2 mb-8 font-bold text-xl text-slate-900 tracking-tight">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
          <Compass className="h-6 w-6" />
        </div>
        <span>ResearchPilot<span className="text-indigo-600">AI</span></span>
      </Link>

      <Card className="w-full max-w-md shadow-xl border-slate-200/80">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Sign in to your account</CardTitle>
          <CardDescription>
            Enter your email and password to access your documents and research notes
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="researcher@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" isLoading={loading} className="w-full text-sm font-semibold">
              Sign In <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>

            <div className="relative w-full my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">Or quick evaluation</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Explore with Demo Account (Instant Access)
            </Button>

            <p className="text-xs text-center text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                Create one now
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
