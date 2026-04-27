import React, { useState, useEffect } from 'react';
import { getMeetingThread } from '../api/chatApi';
import { ExternalLink, Video } from "lucide-react";

interface MeetingCardProps {
    meetingThreadId: string;
    jitsiRoomName: string;
    starterName: string;
    isEnded?: boolean;
    duration?: number;
    participantCount?: number;
    theme?: 'dark' | 'light';
    onJoin?: (jitsiUrl: string) => void;
}

const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
};

const MeetingCard: React.FC<MeetingCardProps> = ({
    meetingThreadId,
    jitsiRoomName,
    starterName,
    isEnded = false,
    duration = 0,
    participantCount = 0,
    theme = 'dark',
    onJoin,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const jitsiDomain = process.env.REACT_APP_JITSI_DOMAIN || 'meet.wisdomlinked.com';
    const jitsiUrl = `https://${jitsiDomain}/${jitsiRoomName}`;

    const loadTranscript = async () => {
        if (transcript.length > 0) {
            setExpanded(!expanded);
            return;
        }
        setLoading(true);
        const data = await getMeetingThread(meetingThreadId);
        if (data?.meeting?.transcript) {
            setTranscript(data.meeting.transcript);
        }
        setExpanded(true);
        setLoading(false);
    };

    const isDark = theme === 'dark';

    return (
        <div className={`my-2 mx-auto max-w-[480px] rounded-xl border overflow-hidden ${
            isDark
                ? 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-[#2a2a4a]'
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
        }`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center gap-3 ${
                isDark ? 'border-b border-[#2a2a4a]' : 'border-b border-blue-200'
            }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                    isEnded
                        ? (isDark ? 'bg-gray-700' : 'bg-gray-200')
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}>
                    <Video className={`h-4 w-4 ${isEnded ? (isDark ? "text-gray-300" : "text-gray-700") : "text-white"}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {isEnded ? 'Meeting Ended' : 'Meeting in Progress'}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        Started by {starterName}
                        {isEnded && duration > 0 && ` · ${formatDuration(duration)}`}
                        {isEnded && participantCount > 0 && ` · ${participantCount} participants`}
                    </div>
                </div>
                {!isEnded && (
                    <button
                        onClick={() => onJoin?.(jitsiUrl)}
                        className="px-4 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:brightness-110 transition-all shadow-sm"
                    >
                        Join call
                    </button>
                )}
            </div>

            {jitsiRoomName ? (
                <div className={`px-4 py-2 text-xs flex items-center gap-1.5 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <a
                        href={jitsiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:opacity-80"
                    >
                        {jitsiUrl}
                    </a>
                </div>
            ) : null}

            {/* Transcript toggle */}
            {isEnded && (
                <button
                    onClick={loadTranscript}
                    className={`w-full px-4 py-2 text-xs text-left transition-colors ${
                        isDark
                            ? 'text-blue-400 hover:bg-[#1e2a44]'
                            : 'text-blue-600 hover:bg-blue-100'
                    }`}
                >
                    {loading ? 'Loading...' : expanded ? '▼ Hide transcript' : '▶ Show meeting transcript'}
                </button>
            )}

            {/* Transcript messages */}
            {expanded && transcript.length > 0 && (
                <div className={`px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto ${
                    isDark ? 'border-t border-[#2a2a4a]' : 'border-t border-blue-200'
                }`}>
                    {transcript.map((msg: any, i: number) => (
                        <div key={i} className="pt-1.5">
                            <span className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                {msg.authorName || msg.author?.username || 'Unknown'}
                            </span>
                            <span className={`text-xs ml-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                                {msg.content}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {expanded && transcript.length === 0 && (
                <div className={`px-4 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                    No messages were sent during this meeting.
                </div>
            )}
        </div>
    );
};

export default MeetingCard;
