import React, { useEffect, useState } from 'react';
import { Bell, ChevronDown, UserCircle2 } from 'lucide-react';

export default function TopBar({
  title = 'Student Dashboard',
  userName = 'Alex Rivera',
  avatarUrl,
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

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
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(o => !o)}
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
                >
                  <UserCircle2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <span>My Profile</span>
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
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

