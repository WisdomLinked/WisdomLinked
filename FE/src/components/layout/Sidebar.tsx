import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  UserCircle,
  Settings,
  MessageSquareMore,
  Video,
  Menu,
  X,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavBadge from './NavBadge';
import { usePendingContactRequestsCount } from '../../hooks/usePendingContactRequestsCount';

const VideoCallNavIcon = ({ className }: { className?: string }) => (
  <Video aria-hidden="true" className={className || 'h-5 w-5'} />
);

const defaultNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'experts', label: 'Find Experts', icon: Users },
  { id: 'seminars', label: 'Seminars', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'join-meeting', label: 'Join Meeting', icon: VideoCallNavIcon },
  { id: 'history', label: 'Payment History', icon: CreditCard },
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
  subItems,
  activeSubItem,
  onNavigateSub,
}: {
  navItems?: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeItem: string;
  onNavigate: (id: string) => void;
  studentName?: string;
  avatarUrl?: string;
  roleLabel?: string;
  notifications?: Record<string, boolean | number>;
  subItems?: Record<string, { id: string; label: string }[]>;
  activeSubItem?: string;
  onNavigateSub?: (navId: string, subId: string) => void;
}) {
  const [openMobile, setOpenMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedNavId, setExpandedNavId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { count: pendingContactCount } = usePendingContactRequestsCount();

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
            className="h-11 w-auto max-w-[260px] shrink-0 object-contain object-left"
          />
          <div className="font-serif font-bold text-[#234c6a] leading-tight text-xl tracking-tight">
            WisdomLinked
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto">
        {mainNavItems.map(item => {
          const Icon = item.icon;
          const isActive = item.id === activeItem;
          const notificationValue =
            item.id === 'contactedus' ? pendingContactCount : notifications[item.id];
          const hasDot = notificationValue === true;
          const count =
            typeof notificationValue === 'number' && Number.isFinite(notificationValue)
              ? Math.max(0, Math.floor(notificationValue))
              : 0;
          const itemSubItems = subItems?.[item.id];
          const isExpanded = expandedNavId === item.id;
          return (
            <div key={item.id}>
            <div className="relative">
            <button
              type="button"
              onClick={() => {
                onNavigate(item.id);
                if (!itemSubItems) setOpenMobile(false);
              }}
              className={`nav-btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none border-l-4 ${
                itemSubItems ? 'pr-9' : ''
              } ${
                isActive
                  ? 'bg-white text-slate-900 border-[#234C6A] shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 border-transparent'
              }`}
            >
              <Icon
                className={item.id === 'join-meeting' ? 'h-5 w-5' : 'h-4 w-4'}
                aria-hidden="true"
              />
              <span className="font-sans min-w-0 flex-1 truncate text-left">{item.label}</span>
              {count > 0 ? (
                <NavBadge count={count} label={`unread ${item.label.toLowerCase()}`} />
              ) : hasDot ? (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                  aria-label={`${item.label} has new notification`}
                />
              ) : null}
            </button>
            {itemSubItems ? (
              <button
                type="button"
                onClick={() => setExpandedNavId(isExpanded ? null : item.id)}
                aria-label={`${isExpanded ? 'Hide' : 'Show'} ${item.label} sections`}
                aria-expanded={isExpanded}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors ${
                  isActive ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white hover:text-slate-700'
                }`}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            </div>
            {itemSubItems && isExpanded ? (
              <div className="mt-0.5 mb-1 space-y-0.5 pl-9">
                {itemSubItems.map(sub => {
                  const subActive = isActive && sub.id === activeSubItem;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        onNavigateSub?.(item.id, sub.id);
                        setOpenMobile(false);
                      }}
                      className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors focus:outline-none ${
                        subActive
                          ? 'bg-white text-[#234C6A] shadow-sm'
                          : 'text-slate-500 hover:bg-white hover:text-slate-800'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            </div>
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
      <aside
        className="hidden lg:block fixed left-0 w-[220px] z-30"
        style={{ top: 'var(--wl-banner-offset, 0px)', height: 'calc(100vh - var(--wl-banner-offset, 0px))' }}
      >
        {content}
      </aside>

      {/* Sits above TopBar (sticky, z-50, opaque) or the header paints over it and
          the menu is unreachable until the page is scrolled. Above the drawer too
          (z-[70]) so the same button closes what it opened. TopBar reserves space
          on the left so the two never overlap. */}
      <button
        type="button"
        className="fixed left-3 z-[80] inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow lg:hidden"
        style={{ top: 'calc(var(--wl-banner-offset, 0px) + 0.75rem)' }}
        onClick={() => setOpenMobile(open => !open)}
        aria-label={openMobile ? 'Close navigation' : 'Open navigation'}
        aria-expanded={openMobile}
      >
        {openMobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {openMobile && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            aria-hidden="true"
            onClick={() => setOpenMobile(false)}
          />
          <div className="relative h-full w-72 max-w-full shadow-2xl pt-12">
            {content}
          </div>
        </div>
      )}

      {/* Logout dialog sits above the mobile drawer (z-[70]) and its toggle (z-[80]):
          it is opened from inside the drawer, so anything lower is unreachable. */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4">
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

