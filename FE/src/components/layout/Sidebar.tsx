import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Video,
  UserCircle,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const defaultNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'experts', label: 'Find Experts', icon: Users },
  { id: 'seminars', label: 'Seminars', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'join-meeting', label: 'Join Meeting', icon: Video },
  { id: 'profile', label: 'Profile', icon: UserCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  navItems = defaultNavItems,
  activeItem,
  onNavigate,
  studentName = 'Alex Rivera',
  avatarUrl,
  roleLabel = 'Student',
}: {
  navItems?: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeItem: string;
  onNavigate: (id: string) => void;
  studentName?: string;
  avatarUrl?: string;
  roleLabel?: string;
}) {
  const [openMobile, setOpenMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  const content = (
    <div className="flex h-full flex-col bg-[#f8fafc] px-3 py-5 border-r border-slate-200">
      <div className="mb-7 pl-1">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden">
            <img
              src="/logo.png"
              alt="WisdomLinked logo"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div>
              <div className="font-serif text-lg font-bold text-[#234c6a] leading-tight">
              WisdomLinked
            </div>
              <div className="mt-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7A7A72]">
                {(roleLabel === 'Expert' || roleLabel === 'Student') ? 'Advising 🔄 Learning' : 'Learning Platform'}
              </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setOpenMobile(false);
              }}
              className={`nav-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none border-l-4 ${
                isActive
                  ? 'bg-white text-slate-900 border-[#234C6A] shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="font-sans">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3 mb-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={studentName}
              className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0f8] text-[11px] font-bold text-[#234c6a]">
              {studentName
                .split(' ')
                .map(part => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-sans text-[13px] font-semibold text-slate-800">
              {studentName}
            </div>
            <div className="font-sans text-[10px] text-slate-400">{roleLabel}</div>
          </div>
        </div>
        <button
          type="button"
          className="mt-1 inline-flex w-full items-center justify-center rounded-lg border border-[#234C6A] bg-[#E8EEF4] px-3 py-1.5 text-[12px] font-semibold text-[#234C6A] hover:bg-[#234C6A] hover:text-white transition-colors"
          onClick={() => {
            setShowLogoutConfirm(true);
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-0 h-screen w-[220px] z-30">
        {content}
      </aside>

      <button
        type="button"
        className="fixed top-3 left-3 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow lg:hidden"
        onClick={() => setOpenMobile(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {openMobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            aria-hidden="true"
            onClick={() => setOpenMobile(false)}
          />
          <div className="relative h-full w-72 max-w-full shadow-2xl">
            <button
              type="button"
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
              onClick={() => setOpenMobile(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {content}
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Sign out?
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to log out and return to the homepage?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-[#234C6A] text-xs font-semibold text-white hover:brightness-95"
                onClick={() => {
                  onNavigate('logout');
                  setShowLogoutConfirm(false);
                  setOpenMobile(false);
                  navigate('/');
                }}
              >
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

