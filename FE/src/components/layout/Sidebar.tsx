import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  UserCircle,
  Settings,
  MessageSquareMore,
  Menu,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VideoCallNavIcon = ({ className }: { className?: string }) => (
  <img src="/icons/video-call.png" alt="" aria-hidden="true" className={className} />
);

const defaultNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'experts', label: 'Find Experts', icon: Users },
  { id: 'seminars', label: 'Seminars', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'join-meeting', label: 'Join Meeting', icon: VideoCallNavIcon },
  { id: 'contact-admin', label: 'Contact admin', icon: MessageSquareMore },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  navItems = defaultNavItems,
  activeItem,
  onNavigate,
  studentName = 'Alex Rivera',
  avatarUrl,
  roleLabel = 'Student',
  notifications = {},
}: {
  navItems?: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeItem: string;
  onNavigate: (id: string) => void;
  studentName?: string;
  avatarUrl?: string;
  roleLabel?: string;
  notifications?: Record<string, boolean | number>;
}) {
  const [openMobile, setOpenMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  const mainNavItems = navItems.filter(item => item.id !== 'profile');

  const goToProfile = () => {
    onNavigate('profile');
    setOpenMobile(false);
  };

  const content = (
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc] px-3 py-5 border-r border-slate-200">
      <div className="mb-7 pl-1">
        <div className="flex items-center gap-2.5">
          <img
            src="/logos/main_gold_blue.svg"
            alt="WisdomLinked logo"
            className="h-9 w-auto max-w-[200px] shrink-0 object-contain object-left"
          />
          <div className="font-serif font-bold text-[#234c6a] leading-tight text-lg tracking-tight">
            WisdomLinked
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto">
        {mainNavItems.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;
          const notificationValue = notifications[item.id];
          const hasDot = notificationValue === true;
          const count =
            typeof notificationValue === 'number' && Number.isFinite(notificationValue)
              ? Math.max(0, Math.floor(notificationValue))
              : 0;
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
              <span className="font-sans inline-flex items-center gap-2">
                {item.label}
                {count > 0 ? (
                  <span
                    className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                    aria-label={`${item.label} has ${count} unread messages`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : hasDot ? (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                    aria-label={`${item.label} has new notification`}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={goToProfile}
          className={`nav-btn mb-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none border-l-4 ${
            activeItem === 'profile'
              ? 'bg-white text-slate-900 border-[#234C6A] shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent'
          }`}
        >
          <UserCircle className="h-4 w-4" aria-hidden="true" />
          <span className="font-sans inline-flex items-center gap-2">
            Profile
            {notifications.profile ? (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                aria-label="Profile has new notification"
              />
            ) : null}
          </span>
        </button>

        <button
          type="button"
          onClick={goToProfile}
          className={`mb-3 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/30 ${
            activeItem === 'profile' ? 'bg-white shadow-sm ring-1 ring-slate-200/80' : 'hover:bg-white/80'
          }`}
          aria-label={`Open profile for ${studentName}`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
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
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[13px] font-semibold text-slate-800 truncate">
              {studentName}
            </div>
            <div className="font-sans text-[10px] text-slate-400">{roleLabel}</div>
          </div>
        </button>
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

