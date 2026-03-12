import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Video,
  UserCircle,
  Menu,
  X,
} from 'lucide-react';

const defaultNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'experts', label: 'Find Mentors', icon: Users },
  { id: 'seminars', label: 'Seminars', icon: Calendar },
  { id: 'profile', label: 'Settings', icon: UserCircle },
];

export default function Sidebar({
  navItems = defaultNavItems,
  activeItem,
  onNavigate,
  studentName = 'Alex Rivera',
}) {
  const [openMobile, setOpenMobile] = useState(false);

  const content = (
    <div className="flex h-full flex-col bg-[#f8fafc] px-3 py-5 border-r border-slate-200">
      <div className="mb-9 pl-1">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 6c0-1.1046.8954-2 2-2h7a2 2 0 0 1 2 2v14l-5-3-5 3V6Z"
                stroke="#234C6A"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M6 7H5a2 2 0 0 0-2 2v11l5-3 2 1.2"
                stroke="#234C6A"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="font-serif text-lg font-bold text-[#234c6a] leading-tight">
              WisdomLinked
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Learning Platform
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate('join-meeting');
          setOpenMobile(false);
        }}
        className="mb-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/60"
        style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}
      >
        <Video className="h-4 w-4" aria-hidden="true" />
        Join Meeting
      </button>

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

      <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
        <div className="avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0f8] text-[11px] font-bold text-[#234c6a]">
          {studentName
            .split(' ')
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div>
          <div className="font-sans text-[13px] font-semibold text-slate-800">
            {studentName}
          </div>
          <div className="font-sans text-[10px] text-slate-400">Student</div>
        </div>
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
    </>
  );
}

