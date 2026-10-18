import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      error('Validation error', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      error('Weak password', 'Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      error('Password mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await register(email, password, fullName || undefined);
      success('Account created!', 'Welcome to ResearchPilot AI.');
      navigate('/app/dashboard');
    } catch (err: any) {
      error('Registration failed', err.message || 'Could not register account.');
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
          <CardTitle className="text-2xl font-bold">Create your workspace</CardTitle>
          <CardDescription>
            Join ResearchPilot AI to begin uploading papers and generating verifiable research syntheses
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Full Name / Title (Optional)</label>
              <Input
                type="text"
                placeholder="Dr. Jordan Hayes"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="researcher@institution.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Password (min. 8 characters)</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Confirm Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" isLoading={loading} className="w-full text-sm font-semibold">
              Create Research Account <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>

            <p className="text-xs text-center text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                Sign in here
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
