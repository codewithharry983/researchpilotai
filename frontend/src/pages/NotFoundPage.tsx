import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 mb-6 shadow-xs">
        <Compass className="h-6 w-6" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 mb-2">404</h1>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-8">
        The research page or resource you requested could not be located.
      </p>
      <Link to="/app/dashboard">
        <Button size="md">
          <ArrowLeft className="h-4 w-4 mr-2" /> Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
