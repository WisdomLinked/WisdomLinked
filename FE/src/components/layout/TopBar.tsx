import React, { useEffect, useState } from 'react';
import { Bell, ChevronDown, UserCircle2, MessageSquare, Users, BookOpen, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { logoutUser } from '../../actions/authActions';

export default function TopBar({
  title = 'Student Dashboard',
  userName = 'Alex Rivera',
  avatarUrl,
  onProfileClick,
}: {
  title?: string;
  userName?: string;
  avatarUrl?: string;
  onProfileClick?: () => void;
}) {
  const dispatch = useDispatch();
  const [openMenu, setOpenMenu] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);

  const notifications = [
    {
      id: 'n1',
      title: 'New seminar added by Prof. Emily Chen',
      meta: '2 hours ago',
      icon: <BookOpen className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />,
    },
    {
      id: 'n2',
      title: 'New expert joined: Dr. Liam Carter',
      meta: 'Today',
      icon: <Users className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />,
    },
    {
      id: 'n3',
      title: 'New chat message from Prof. Daniel Ortiz',
      meta: '5 mins ago',
      icon: <MessageSquare className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />,
    },
  ];

  useEffect(() => {
    if (!openMenu) {
      setMenuVisible(false);
      return;
    }
    const id = window.setTimeout(() => setMenuVisible(true), 10);
    return () => window.clearTimeout(id);
  }, [openMenu]);

  return (
    <header className="sticky top-0 z-20 border-b border-[#e8e6e1] bg-white">
      <div className="flex h-14 items-center justify-between px-6">
        <span className="font-sans text-[14px] font-semibold text-slate-800">
          {title}
        </span>
        <div className="relative flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setOpenNotifications(o => !o);
              setOpenMenu(false);
            }}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </button>
          {openNotifications && (
            <div className="absolute right-16 top-10 z-30 w-[320px] rounded-xl border border-[#E5E2DB] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.10)]">
              <div className="border-b border-[#E5E2DB] px-4 py-3 flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                  Notifications
                </p>
                <button
                  type="button"
                  onClick={() => setOpenNotifications(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {notifications.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-[#F5F3EF]"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EEF4]">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#7A7A72]">{item.meta}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenMenu(o => !o);
                setOpenNotifications(false);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
              aria-haspopup="menu"
              aria-expanded={openMenu}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0f8] text-[11px] font-bold text-[#234c6a]">
                  {userName
                    .split(' ')
                    .map(part => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate font-sans sm:inline-block">
                {userName}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
            </button>
            {openMenu && (
              <div
                className={`absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-lg transition-all duration-150 ease-out ${
                  menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  onClick={() => {
                    onProfileClick?.();
                    setOpenMenu(false);
                  }}
                >
                  <UserCircle2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <span>My Profile</span>
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                  onClick={() => {
                    dispatch(logoutUser() as any);
                    setOpenMenu(false);
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

