import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  Settings,
  Wallet,
  UserCheck,
  AlertCircle,
  MessageSquareMore,
} from 'lucide-react';

import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import type { TopBarNotificationItem } from '../components/layout/TopBar';
import StudentSettings from '../components/dashboard/StudentSettings';
import { profileImageFetch } from '../api/api';
import { useAppSelector } from '../store';
import { logoutUser, updateMe } from '../actions/authActions';
import { showAlert } from '../actions/alertActions';
import { setChosenGroupChatDetails } from '../actions/chatActions';


// Reuse existing expert dashboard feature pages (legacy MUI pages)
import ExpertCalendar from './Dashboard/_ExpertDashboard/calendar';
import ExpertAvailability from './Dashboard/_ExpertDashboard/availability';
import ExpertSeminarHub from './Dashboard/_ExpertDashboard/ExpertSeminarHub';
import ExpertSearch from './Dashboard/_ExpertDashboard/search';
import ExpertProfile from './Dashboard/_ExpertDashboard/profile';
import ExpertRevenue from './Dashboard/_ExpertDashboard/ExpertRevenue';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import StudentChat from '../components/dashboard/StudentChat';
import StatCard from '../components/ui/StatCard';
import Chatbot from '../components/chatbot';
import UpcomingSessionModal, {
  type UpcomingModalSession,
} from '../components/dashboard/UpcomingSessionModal';

function mapExpertGroupToModalSession(g: any): UpcomingModalSession {
  const start = g?.start ? new Date(g.start).getTime() : Date.now();
  const when = g?.start
    ? new Date(g.start).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  let withLabel = 'Session';
  if (g?.type === 'seminar') {
    const n = Array.isArray(g.participants) ? g.participants.length : 0;
    withLabel = n ? `${n} enrolled` : 'Seminar';
  } else {
    const parts = g.participants || [];
    const first = parts[0];
    if (first && typeof first === 'object' && first.username) {
      withLabel = first.username;
    } else if (parts.length) {
      withLabel = `${parts.length} participant(s)`;
    } else {
      withLabel = '1:1 session';
    }
  }
  return {
    id: String(g._id),
    title: g.name || 'Session',
    at: start,
    when,
    location: 'Online · WisdomLinked',
    with: withLabel,
  };
}

function mapPendingSeminarToModal(pg: any): UpcomingModalSession {
  const g = pg?.groupChatId;
  if (!g?._id) {
    return {
      id: String(pg._id || 'pending'),
      title: 'Seminar',
      at: Date.now(),
      when: '—',
      location: 'Online · WisdomLinked',
      with: 'Pending invite',
    };
  }
  const base = mapExpertGroupToModalSession(g);
  return { ...base, with: 'Awaiting confirmation' };
}

export default function ExpertDashboard() {
  const dispatch = useDispatch();
  const location = useLocation();

  const {
    auth: { userDetails },
  } = useAppSelector((state) => state);

  const [activeItem, setActiveItem] = useState('dashboard');
  // Dummy unread indicator for sidebar showcase; replace with backend unread count later.
  const [hasNewChatMessage, setHasNewChatMessage] = useState(true);
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [expertUpcomingModal, setExpertUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
  } | null>(null);

  const userDetailsRef = useRef(userDetails);
  userDetailsRef.current = userDetails;

  const expertNotifications: TopBarNotificationItem[] = useMemo(
    () => [
      {
        id: 'e1',
        title: 'New 1:1 session request',
        meta: 'A student requested a session — review in Clients.',
        icon: <Users className="h-3.5 w-3.5 text-[#234C6A]" aria-hidden />,
      },
      {
        id: 'e2',
        title: 'Student joined your seminar',
        meta: 'Someone registered for your upcoming seminar.',
        icon: <BookOpen className="h-3.5 w-3.5 text-[#234C6A]" aria-hidden />,
      },
      {
        id: 'e3',
        title: 'Reminder: session starting soon',
        meta: 'You have a 1:1 or seminar in the next hour.',
        icon: <Clock className="h-3.5 w-3.5 text-[#234C6A]" aria-hidden />,
      },
    ],
    []
  );

  // Auth + socket only. Do NOT call updateMe() when userDetails changes — that caused an
  // infinite loop (updateMe → new userDetails → effect → updateMe) and broke pages like Seminar.
  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || String(userDetails?.role).toLowerCase() !== 'expert') {
      dispatch(logoutUser() as any);
    }
  }, [
    userDetails?.email,
    userDetails?.role,
    userDetails?._id,
    dispatch,
  ]);

  // Refresh profile when the route changes or socket first becomes ready — not on every userDetails update.
  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || String(userDetails?.role).toLowerCase() !== 'expert') {
      return;
    }
    dispatch(updateMe() as any);
  }, [
    location.pathname,
    userDetails?.email,
    userDetails?.role,
    dispatch,
  ]);

  useEffect(() => {
    const image = userDetails?.image as string | undefined;
    if (!image) {
      setAvatarUrl(undefined);
      return;
    }
    profileImageFetch(image, 'small')
      .then((img: unknown) => {
        if (typeof img === 'string') setAvatarUrl(img);
        else setAvatarUrl(undefined);
      })
      .catch(() => setAvatarUrl(undefined));
  }, [userDetails?.image]);

  useEffect(() => {
    if (activeItem === 'chat') {
      setHasNewChatMessage(false);
    }
  }, [activeItem]);

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'seminar', label: 'Seminar', icon: BookOpen },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'availability', label: 'Availability', icon: Clock },
      { id: 'contact-admin', label: 'Contact admin', icon: MessageSquareMore },
      { id: 'revenue', label: 'Revenue', icon: Wallet },
      { id: 'settings', label: 'Settings', icon: Settings },
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

  const expertModalSessions = useMemo((): UpcomingModalSession[] => {
    if (!expertUpcomingModal) return [];
    const { kind, status } = expertUpcomingModal;
    if (kind === 'oneToOne') {
      const list = status === 'booked' ? bookedSessions : pendingSessions;
      return list.map(mapExpertGroupToModalSession);
    }
    if (status === 'booked') {
      return acceptedSeminars.map(mapExpertGroupToModalSession);
    }
    return pendingSeminars.map(mapPendingSeminarToModal);
  }, [
    expertUpcomingModal,
    bookedSessions,
    pendingSessions,
    acceptedSeminars,
    pendingSeminars,
  ]);

  const handleExpertJoinSession = (session: UpcomingModalSession) => {
    const id = session.id;
    const raw =
      bookedSessions.find((x: any) => String(x._id) === id) ||
      acceptedSeminars.find((x: any) => String(x._id) === id);
    if (!raw) {
      dispatch(showAlert('Could not open this session.'));
      return;
    }
    dispatch(
      setChosenGroupChatDetails({
        ...raw,
        groupId: raw._id,
        groupName: raw.name,
      } as any)
    );
    setExpertUpcomingModal(null);
    setActiveItem('chat');
  };

  const title =
    activeItem === 'chat'
      ? 'Chat'
      : activeItem === 'clients'
        ? 'Clients'
        : activeItem === 'revenue'
          ? 'Revenue'
          : activeItem === 'contact-admin'
            ? 'Contact admin'
          : activeItem === 'seminar'
            ? 'Seminar'
            : activeItem === 'calendar'
              ? 'Calendar'
              : activeItem === 'availability'
                ? 'Availability'
                : activeItem === 'profile'
                  ? 'Profile'
                  : activeItem === 'settings'
                    ? 'Settings'
                    : 'Expert Dashboard';

  const content =
    activeItem === 'chat' ? (
      <div className="h-[calc(100vh-56px)] bg-wl-chatGold">
        <StudentChat />
      </div>
    ) : activeItem === 'clients' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSearch />
      </div>
    ) : activeItem === 'revenue' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertRevenue />
      </div>
    ) : activeItem === 'contact-admin' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ContactAdmin />
      </div>
    ) : activeItem === 'seminar' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSeminarHub />
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
    ) : activeItem === 'settings' ? (
      <StudentSettings />
    ) : (
      <div className="px-6 py-7 space-y-6">
        {/* Stats row */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-900 mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              label="Upcoming 1:1 sessions"
              value={bookedSessions.length}
              icon={UserCheck}
              color="success"
              tooltip="View sessions and join the meeting room"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'oneToOne', status: 'booked' })
              }
            />
            <StatCard
              label="Upcoming seminars"
              value={acceptedSeminars.length}
              icon={BookOpen}
              color="primary"
              tooltip="Your hosted seminars — join opens chat"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'seminar', status: 'booked' })
              }
            />
            <StatCard
              label="Pending 1:1 sessions"
              value={pendingSessions.length}
              icon={AlertCircle}
              color="warning"
              tooltip="Requests awaiting confirmation"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'oneToOne', status: 'pending' })
              }
            />
            <StatCard
              label="Pending seminar requests"
              value={pendingSeminars.length}
              icon={AlertCircle}
              color="warning"
              tooltip="Seminar invites awaiting your confirmation"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'seminar', status: 'pending' })
              }
            />
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
          notifications={{ chat: hasNewChatMessage }}
        />

        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={title}
            userName={expertName}
            avatarUrl={avatarUrl}
            notifications={expertNotifications}
            onProfileClick={() => setActiveItem('profile')}
            onSettingsClick={() => setActiveItem('settings')}
          />
          {content}
          {activeItem !== 'chat' ? <Chatbot /> : null}

          {/* Keep call UX working in the new layout */}
        </main>

        {expertUpcomingModal ? (
          <UpcomingSessionModal
            kind={expertUpcomingModal.kind}
            status={expertUpcomingModal.status}
            role="expert"
            sessions={expertModalSessions}
            onClose={() => setExpertUpcomingModal(null)}
            onJoinSession={
              expertUpcomingModal.status === 'booked'
                ? handleExpertJoinSession
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}

