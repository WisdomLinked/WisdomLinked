import React, { useState } from 'react';
import { Video, Lock } from 'lucide-react';

export default function JoinMeeting() {
  const [code, setCode] = useState('');

  const handleJoin = () => {
    if (!code.trim()) return;
    // TODO: wire this up to actual meeting join flow
    // For now we just clear the field.
    setCode('');
  };

  return (
    <div className="h-[calc(100vh-56px)] flex items-center justify-center px-4 bg-[#F5F3EF]">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]">
            <Video className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              Join a meeting
            </h1>
            <p className="text-xs text-slate-500">
              Enter the meeting ID or code shared by your mentor.
            </p>
          </div>
        </div>

        <label className="mb-2 block text-[11px] font-medium text-slate-600">
          Meeting ID / code
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. WL-ABC-1234"
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>

        <button
          type="button"
          onClick={handleJoin}
          disabled={!code.trim()}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          Join meeting
        </button>
      </div>
    </div>
  );
}

