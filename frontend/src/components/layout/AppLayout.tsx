import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Sparkles,
  Scale,
  StickyNote,
  Settings,
  LogOut,
  Upload,
  Menu,
  X,
  Compass,
  Cpu,
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { label: 'My Documents', path: '/app/documents', icon: FileText },
    { label: 'Research Chat', path: '/app/chat', icon: MessageSquare },
    { label: 'ResearchPilot Studio', path: '/app/studio', icon: Radio },
    { label: 'Summarizer', path: '/app/summarizer', icon: Sparkles },
    { label: 'Paper Comparison', path: '/app/comparison', icon: Scale },
    { label: 'Saved Notes', path: '/app/notes', icon: StickyNote },
    { label: 'Settings & Usage', path: '/app/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <NavLink to="/app/dashboard" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Compass className="h-5 w-5" />
            </div>
            <span>ResearchPilot<span className="text-indigo-600 ml-0.5">AI</span></span>
          </NavLink>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Action */}
        <div className="p-4">
          <Button
            onClick={() => {
              navigate('/app/documents?action=upload');
              setMobileMenuOpen(false);
            }}
            className="w-full shadow-sm"
          >
            <Upload className="h-4 w-4 mr-2" /> Upload PDF
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 text-xs uppercase">
                {user?.full_name ? user.full_name[0] : (user?.email ? user.email[0] : 'U')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user?.full_name || 'Researcher'}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar for Mobile */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Compass className="h-5 w-5 text-indigo-600" />
            <span>ResearchPilot AI</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
