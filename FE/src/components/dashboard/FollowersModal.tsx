import React from 'react';
import { X, Users } from 'lucide-react';

export type FollowerEntry = {
  _id: string;
  username?: string;
  email?: string;
  image?: string | null;
  currentUniversity?: string;
  degreeSought?: string;
  country?: string;
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function FollowersModal({
  isOpen,
  followers,
  loading,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  followers: FollowerEntry[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (follower: FollowerEntry) => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center bg-black/40 px-4 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#E5E2DB] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E2DB] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EEF4]">
              <Users className="h-4 w-4 text-[#234C6A]" aria-hidden />
            </span>
            <p className="text-[13px] font-semibold text-slate-900">
              Followers
              <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                {followers.length}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close followers"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="px-3 py-8 text-center text-[12px] text-slate-500">
              Loading followers…
            </div>
          ) : followers.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-slate-500">
              No followers yet.
            </div>
          ) : (
            followers.map((f) => {
              const name = f.username || f.email || 'Student';
              const meta = [f.degreeSought, f.currentUniversity, f.country]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={f._id}
                  type="button"
                  onClick={() => onSelect(f)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#F5F3EF]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0f8] text-[11px] font-bold text-[#234c6a]">
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {name}
                    </p>
                    {meta ? (
                      <p className="truncate text-[11px] text-slate-500">{meta}</p>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
