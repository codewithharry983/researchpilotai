import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentLibraryPage } from './pages/DocumentLibraryPage';
import { DocumentReaderPage } from './pages/DocumentReaderPage';
import { ResearchChatPage } from './pages/ResearchChatPage';
import { SummarizerPage } from './pages/SummarizerPage';
import { ComparisonWorkspacePage } from './pages/ComparisonWorkspacePage';
import { SavedNotesPage } from './pages/SavedNotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudioPage } from './pages/StudioPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000
    }
  }
});

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Authenticating research session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected App Routes */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="documents" element={<DocumentLibraryPage />} />
                <Route path="documents/:id" element={<DocumentReaderPage />} />
                <Route path="chat" element={<ResearchChatPage />} />
                <Route path="chat/:id" element={<ResearchChatPage />} />
                <Route path="studio" element={<StudioPage />} />
                <Route path="summarizer" element={<SummarizerPage />} />
                <Route path="comparison" element={<ComparisonWorkspacePage />} />
                <Route path="notes" element={<SavedNotesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
