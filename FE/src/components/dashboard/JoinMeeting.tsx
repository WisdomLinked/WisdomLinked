import React, { useState } from 'react';
import { Lock, Video } from 'lucide-react';
import { getMeetingJoinInfo } from '../../api/chatApi';

export default function JoinMeeting() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const openMeetingUrl = (jitsiUrl?: string, pendingWindow: Window | null = null) => {
    if (!jitsiUrl) {
      if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
      return;
    }
    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.location.href = jitsiUrl;
      return;
    }
    window.location.assign(jitsiUrl);
  };

  const handleJoin = async () => {
    const meetingThreadId = code.trim();
    if (!meetingThreadId || joining) return;
    setError('');
    setJoining(true);
    const pendingWindow = window.open('', '_blank');
    try {
      const res = await getMeetingJoinInfo(meetingThreadId);
      if (res?.success && res.jitsiUrl) {
        openMeetingUrl(res.jitsiUrl, pendingWindow);
        return;
      }
      if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
      setError(res?.error || 'Unable to join this meeting. Please check the ID and try again.');
    } catch (err: any) {
      if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
      setError(err?.message || 'Unable to join this meeting. Please check the ID and try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] flex items-center justify-center px-4 bg-[#F5F3EF]">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]">
            <Video aria-hidden className="h-7 w-7" strokeWidth={2.2} />
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
            onKeyDown={e => {
              if (e.key === 'Enter') void handleJoin();
            }}
            placeholder="Paste meeting ID"
            aria-label="Meeting ID"
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>
        {error ? (
          <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleJoin()}
          disabled={!code.trim() || joining}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {joining ? 'Joining...' : 'Join meeting'}
        </button>
      </div>
    </div>
  );
}

