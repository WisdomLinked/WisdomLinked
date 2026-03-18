import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Clock,
  UserCircle,
  LayoutDashboard,
} from 'lucide-react';

import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import { useAppSelector } from '../store';
import { connectWithSocketServer, UserDetails } from '../socket/socketConnection';
import { logoutUser, updateMe } from '../actions/authActions';

import IncomingCall from '../components/IncomingCall';
import VideoChat from '../components/VideoChat';

// Reuse existing expert dashboard feature pages (legacy MUI pages)
import ExpertCalendar from './Dashboard/_ExpertDashboard/calendar';
import ExpertAvailability from './Dashboard/_ExpertDashboard/availability';
import ExpertSeminar from './Dashboard/_ExpertDashboard/seminar';
import ExpertSearch from './Dashboard/_ExpertDashboard/search';
import ExpertProfile from './Dashboard/_ExpertDashboard/profile';
import ModernChat from './Dashboard/_ExpertDashboard/ModernChat';
import ChatPage from './ChatPage';

export default function ExpertDashboard() {
  const dispatch = useDispatch();
  const location = useLocation();

  const {
    auth: { userDetails },
    app: { connectedWithSocketServer },
    videoChat: { localStream, otherUserId },
    room: { isUserInRoom, localStreamRoom },
  } = useAppSelector((state) => state);

  const [activeItem, setActiveItem] = useState('dashboard');
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');

  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || String(userDetails?.role).toLowerCase() !== 'expert') {
      dispatch(logoutUser());
      return;
    }

    if (!connectedWithSocketServer) {
      connectWithSocketServer(userDetails as UserDetails);
      dispatch({
        type: 'SetConnectedWithSocketServer',
        payload: true,
      });
      return;
    }

    // keep userDetails fresh
    updateMe();
  }, [userDetails, connectedWithSocketServer, location, dispatch]);

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'seminar', label: 'Seminar', icon: BookOpen },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'availability', label: 'Availability', icon: Clock },
      { id: 'profile', label: 'Profile', icon: UserCircle },
    ],
    []
  );

  const expertName = userDetails?.username || 'Expert';

  const now = new Date();

  const inSelectedRange = (date: Date) => {
    if (range === 'all') return true;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(startOfToday);
    if (range === 'week') {
      const day = start.getDay();
      const diff = (day + 6) % 7; // Monday start
      start.setDate(start.getDate() - diff);
    }
    const end = new Date(start);
    if (range === 'today') {
      end.setDate(start.getDate() + 1);
    } else {
      end.setDate(start.getDate() + 7);
    }
    return date >= start && date < end;
  };

  const {
    acceptedSeminars,
    pendingSeminars,
    bookedSessions,
    pendingSessions,
  } = useMemo(() => {
    const { groupChats = [], pendingGroupChats = [] } = (userDetails || {}) as any;
    const nowTs = Date.now();

    const upcoming = (start: any, end: any) => {
      const endTs = new Date(end).getTime();
      return endTs >= nowTs;
    };

    const seminars = (groupChats || []).filter(
      (g: any) =>
        g.type === 'seminar' &&
        upcoming(g.start, g.end) &&
        inSelectedRange(new Date(g.start))
    );

    const sessions = (groupChats || []).filter(
      (g: any) =>
        g.type === 'individual' &&
        g.status === 'active' &&
        upcoming(g.start, g.end) &&
        inSelectedRange(new Date(g.start))
    );

    const pendingSess = (groupChats || []).filter(
      (g: any) =>
        g.type === 'individual' &&
        g.status === 'pending' &&
        upcoming(g.start, g.end) &&
        inSelectedRange(new Date(g.start))
    );

    const pendingSemInvites = (pendingGroupChats || []).filter(
      (pg: any) =>
        pg.groupChatId?.type === 'seminar' &&
        upcoming(pg.groupChatId.start, pg.groupChatId.end) &&
        inSelectedRange(new Date(pg.groupChatId.start))
    );

    return {
      acceptedSeminars: seminars,
      pendingSeminars: pendingSemInvites,
      bookedSessions: sessions,
      pendingSessions: pendingSess,
    };
  }, [userDetails, range]);

  const totalRevenuePlaceholder =
    (bookedSessions?.length || 0) * (userDetails?.price || 50) +
    (acceptedSeminars?.length || 0) * (userDetails?.price || 50);

  const title =
    activeItem === 'chat'
      ? 'Chat'
      : activeItem === 'clients'
        ? 'Clients'
        : activeItem === 'seminar'
          ? 'Seminar'
          : activeItem === 'calendar'
            ? 'Calendar'
            : activeItem === 'availability'
              ? 'Availability'
              : activeItem === 'profile'
                ? 'Profile'
                : 'Expert Dashboard';

  const content =
    activeItem === 'chat' ? (
      <div className="h-[calc(100vh-56px)] overflow-hidden bg-[#F5F3EF]">
        <ChatPage />
      </div>
    ) : activeItem === 'clients' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSearch />
      </div>
    ) : activeItem === 'seminar' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSeminar />
      </div>
    ) : activeItem === 'calendar' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertCalendar />
      </div>
    ) : activeItem === 'availability' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertAvailability />
      </div>
    ) : activeItem === 'profile' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertProfile userDetails={userDetails} />
      </div>
    ) : (
      <div className="px-6 py-7 space-y-6">
        {/* Stats row */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-900 mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[12px] font-medium text-slate-500 mb-1">
                Upcoming 1:1 sessions
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {bookedSessions.length}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[12px] font-medium text-slate-500 mb-1">
                Pending 1:1 requests
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {pendingSessions.length}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[12px] font-medium text-slate-500 mb-1">
                Upcoming seminars
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {acceptedSeminars.length}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[12px] font-medium text-slate-500 mb-1">
                Est. revenue (placeholder)
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                ${totalRevenuePlaceholder}
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Today&apos;s and upcoming sessions
          </h3>
          <div className="inline-flex rounded-full bg-slate-100 p-0.5">
            {(['today', 'week', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-full capitalize transition ${
                  range === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {key === 'all' ? 'All upcoming' : key}
              </button>
            ))}
          </div>
        </section>

        {/* Lists */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1:1 sessions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">
                1:1 Sessions
              </h4>
              <span className="text-[11px] text-slate-500">
                {bookedSessions.length} booked · {pendingSessions.length} pending
              </span>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {bookedSessions.map((s: any) => (
                <div
                  key={s._id}
                  className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(s.start).toLocaleString()}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Confirmed
                  </span>
                </div>
              ))}
              {pendingSessions.map((s: any) => (
                <div
                  key={s._id}
                  className="flex items-start justify-between rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {new Date(s.start).toLocaleString()}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Pending
                  </span>
                </div>
              ))}
              {!bookedSessions.length && !pendingSessions.length && (
                <p className="text-[12px] text-slate-500">
                  No upcoming 1:1 sessions in this range.
                </p>
              )}
            </div>
          </div>

          {/* Seminars */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">
                Seminars
              </h4>
              <span className="text-[11px] text-slate-500">
                {acceptedSeminars.length} accepted · {pendingSeminars.length} invites
              </span>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {acceptedSeminars.map((g: any) => (
                <div
                  key={g._id}
                  className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {g.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(g.start).toLocaleString()}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Confirmed
                  </span>
                </div>
              ))}
              {pendingSeminars.map((pg: any) => (
                <div
                  key={pg._id}
                  className="flex items-start justify-between rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {pg.groupChatId?.name}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {pg.groupChatId?.start
                        ? new Date(pg.groupChatId.start).toLocaleString()
                        : ''}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Pending invite
                  </span>
                </div>
              ))}
              {!acceptedSeminars.length && !pendingSeminars.length && (
                <p className="text-[12px] text-slate-500">
                  No upcoming seminars in this range.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={(id) => {
            if (id === 'logout') {
              dispatch(logoutUser() as any);
              return;
            }
            setActiveItem(id);
          }}
          navItems={navItems}
          studentName={expertName}
          roleLabel="Expert"
        />

        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={title}
            userName={expertName}
            onProfileClick={() => setActiveItem('profile')}
          />
          {content}

          {/* Keep call UX working in the new layout */}
          <IncomingCall />
          {(localStream || localStreamRoom) && (
            <VideoChat role={userDetails?.role} otherUserId={otherUserId} />
          )}
        </main>
      </div>
    </div>
  );
}

