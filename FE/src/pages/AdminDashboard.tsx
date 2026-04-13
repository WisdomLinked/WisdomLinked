import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  MessageCircleWarning,
  Inbox,
  UserPlus,
  Bot,
  Shield,
  Calendar,
} from 'lucide-react';

import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import type { TopBarNotificationItem } from '../components/layout/TopBar';
import StatCard from '../components/ui/StatCard';
import AdminMetricsPanel from '../components/dashboard/AdminMetricsPanel';
import { doGetAdminDashboardStats, type AdminDashboardStatsData } from '../api/api';
import StudentSettings from '../components/dashboard/StudentSettings';
import { profileImageFetch } from '../api/api';
import { useAppSelector } from '../store';
import { logoutUser } from '../actions/authActions';

import AdminChat from './AdminChat';
import Feedback from '../components/getFeedback';
import GetContactedUs from '../components/getContactedUs';
import RegisterUserByAdmin from '../components/registerUserByAdmin';
import ChatBotQA from './Dashboard/_AdminDashboard/chatBotQA';
import UserMgmt from './Dashboard/_AdminDashboard/usermgmt';
import Payment from './Dashboard/_AdminDashboard/payment';
import AdminUpcomingEvents from './Dashboard/_AdminDashboard/adminUpcomingEvents';
import Chatbot from '../components/chatbot';

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || '/user/';

const adminNavItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'usermgmt', label: 'User management', icon: Users },
  { id: 'payment', label: 'Payments', icon: CreditCard },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'upcomingEvents', label: 'Upcoming events', icon: Calendar },
  { id: 'feedbacks', label: 'Feedback', icon: MessageCircleWarning },
  { id: 'contactedus', label: 'Contact requests', icon: Inbox },
  { id: 'registerUser', label: 'Register user', icon: UserPlus },
  { id: 'chatBotQA', label: 'Chatbot Q&A', icon: Bot },
];

function pathToSection(pathname: string): string {
  const m = pathname.match(/\/admindashboard\/?(.*)$/);
  const rest = (m?.[1] || '').replace(/\/$/, '');
  if (!rest) return 'dashboard';
  return rest;
}

const emptyStats: AdminDashboardStatsData = {
  pendingApprovals: 0,
  newContactMessages: 0,
  unansweredChatbotQuestions: 0,
  expertCount: 0,
  customerCount: 0,
  oneOnOneSessions: 0,
  seminarsHeld: 0,
  totalPayments: 0,
  refundCount: 0,
  todayUpcomingEvents: 0,
};

function AdminOverview({ go }: { go: (id: string, search?: string) => void }) {
  const [stats, setStats] = useState<AdminDashboardStatsData>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const res = await doGetAdminDashboardStats();
      if (!cancelled && res?.status === 'SUCCESS' && res.data) {
        setStats(res.data);
      }
      if (!cancelled) setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number) => (statsLoading ? '—' : n);
  const todayCount =
    statsLoading || stats.todayUpcomingEvents === undefined
      ? '—'
      : stats.todayUpcomingEvents;

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <section className="text-left">
          <h2 className="text-2xl font-semibold text-wl-brand">Overview</h2>
          <p className="mt-1 text-sm text-wl-muted">
            Manage users, billing, contact requests, and platform configuration from one place.
          </p>
        </section>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div className="w-full space-y-4 text-left lg:max-w-md lg:shrink-0">
            <StatCard
              alignStart
              label="User management"
              value={fmt(stats.pendingApprovals)}
              subline="Pending approvals (sign-ups & logins)"
              icon={Users}
              color="primary"
              tooltip="Review pending accounts and approve users"
              onClick={() => go('usermgmt')}
            />
            <StatCard
              alignStart
              label="Payments"
              value={fmt(stats.totalPayments)}
              subline="Payment records (excl. refund-only rows)"
              icon={CreditCard}
              color="success"
              tooltip="Stripe mode, refunds, payment links"
              onClick={() => go('payment')}
            />
            <StatCard
              alignStart
              label="Contact us"
              value={fmt(stats.newContactMessages)}
              subline="New messages awaiting action"
              icon={Inbox}
              color="neutral"
              tooltip="Messages from the public contact form"
              onClick={() => go('contactedus')}
            />
            <StatCard
              alignStart
              label="Chatbot Q&A"
              value={fmt(stats.unansweredChatbotQuestions)}
              subline="User questions without an answer yet"
              icon={Bot}
              color="warning"
              tooltip="Curate chatbot knowledge"
              onClick={() => go('chatBotQA')}
            />
          </div>

          <div className="min-w-0 flex-1">
            {statsLoading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-wl-line bg-wl-card/50 text-sm text-wl-muted">
                Loading platform snapshot…
              </div>
            ) : (
              <AdminMetricsPanel stats={stats} />
            )}
          </div>
        </div>

        <section>
          <h3 className="mb-3 text-left text-sm font-semibold uppercase tracking-wide text-wl-muted">
            More
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => go('upcomingEvents', '?scope=today')}
              className="text-left rounded-2xl border border-wl-line bg-wl-card p-5 shadow-[0_10px_30px_rgba(35,76,106,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(35,76,106,0.12)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-wl-ink">Upcoming events</div>
                  <div className="mt-1 text-[13px] text-wl-muted">
                    Today — 1:1 bookings & seminars still scheduled (not ended).
                  </div>
                </div>
                <div className="shrink-0 rounded-xl bg-wl-brandSoft px-3 py-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-wl-muted">
                    Today
                  </div>
                  <div className="font-serif text-2xl font-bold tabular-nums leading-tight text-wl-brand">
                    {todayCount}
                  </div>
                </div>
              </div>
            </button>
            {(
              [
                {
                  title: 'Feedback',
                  desc: 'Review event and session feedback.',
                  id: 'feedbacks' as const,
                },
                {
                  title: 'Community chat',
                  desc: 'Shared chats and direct messages.',
                  id: 'chat' as const,
                },
              ] as const
            ).map(card => (
              <button
                key={card.id}
                type="button"
                onClick={() => go(card.id)}
                className="text-left rounded-2xl border border-wl-line bg-wl-card p-5 shadow-[0_10px_30px_rgba(35,76,106,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(35,76,106,0.12)]"
              >
                <div className="text-[15px] font-semibold text-wl-ink">{card.title}</div>
                <div className="mt-1 text-[13px] text-wl-muted">{card.desc}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminProfileCard({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email?: string;
  avatarUrl?: string;
}) {
  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-wl-page px-6 py-7">
      <div className="max-w-lg rounded-2xl border border-wl-line bg-wl-card p-6 shadow-[0_10px_30px_rgba(35,76,106,0.08)]">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wl-brandSoft text-lg font-bold text-wl-brand">
              {name
                .split(' ')
                .map(p => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-wl-ink">
              <Shield className="h-5 w-5 text-wl-brand" aria-hidden />
              {name}
            </div>
            <div className="text-sm text-wl-muted">Administrator</div>
            {email ? <div className="mt-1 text-sm text-wl-ink/80">{email}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    auth: { userDetails },
  } = useAppSelector(state => state);

  const [extraView, setExtraView] = useState<'profile' | 'settings' | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const section = useMemo(() => pathToSection(location.pathname), [location.pathname]);

  const sidebarActive =
    extraView === 'profile' || extraView === 'settings' ? extraView : section;

  const adminName =
    (userDetails?.username as string | undefined) ||
    (userDetails?.name as string | undefined) ||
    'Admin';

  const adminNotifications: TopBarNotificationItem[] = useMemo(
    () => [
      {
        id: 'a1',
        title: 'User pending approval',
        meta: 'Review pending sign-ups in User management.',
        icon: <Users className="h-3.5 w-3.5 text-wl-brand" aria-hidden />,
      },
      {
        id: 'a2',
        title: 'New contact request',
        meta: 'Someone submitted the contact form.',
        icon: <Inbox className="h-3.5 w-3.5 text-wl-brand" aria-hidden />,
      },
      {
        id: 'a3',
        title: 'Payment activity',
        meta: 'Check refunds and payment links in Payments.',
        icon: <CreditCard className="h-3.5 w-3.5 text-wl-brand" aria-hidden />,
      },
    ],
    []
  );

  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || userDetails?.role !== 'admin') {
      dispatch(logoutUser());
      return;
    }
  }, [userDetails?.email, userDetails?.role,  userDetails]);

  useEffect(() => {
    setExtraView(null);
  }, [location.pathname]);

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

  const goToSection = (id: string, search = '') => {
    if (id === 'dashboard') {
      navigate(`${AUTH_BASE}admindashboard`);
      return;
    }
    navigate(`${AUTH_BASE}admindashboard/${id}${search}`);
  };

  const title =
    extraView === 'profile'
      ? 'Profile'
      : extraView === 'settings'
        ? 'Settings'
        : section === 'usermgmt'
          ? 'User management'
          : section === 'payment'
            ? 'Payments'
            : section === 'chat'
              ? 'Chat'
              : section === 'feedbacks'
                ? 'Feedback'
                : section === 'contactedus'
                  ? 'Contact requests'
                  : section === 'registerUser'
                    ? 'Register user'
                    : section === 'chatBotQA'
                      ? 'Chatbot Q&A'
                      : section === 'upcomingEvents'
                        ? 'Upcoming events'
                        : 'Admin Dashboard';

  const handleSidebarNavigate = (id: string) => {
    if (id === 'logout') {
      dispatch(logoutUser());
      return;
    }
    if (id === 'profile') {
      setExtraView('profile');
      return;
    }
    setExtraView(null);
    goToSection(id === 'dashboard' ? 'dashboard' : id);
  };

  const mainScroll = (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-wl-page">
      <Routes>
        <Route index element={<AdminOverview go={goToSection} />} />
        <Route path="usermgmt" element={<UserMgmt />} />
        <Route path="payment" element={<Payment />} />
        <Route path="feedbacks" element={<Feedback />} />
        <Route path="contactedus" element={<GetContactedUs />} />
        <Route path="registerUser" element={<RegisterUserByAdmin />} />
        <Route path="upcomingEvents" element={<AdminUpcomingEvents />} />
        <Route path="chatBotQA" element={<ChatBotQA />} />
        <Route path="*" element={<AdminOverview go={goToSection} />} />
      </Routes>
    </div>
  );

  return (
    <div className="min-h-screen bg-wl-pageAlt text-[14px] text-wl-ink">
      <div className="flex min-h-screen">
        <Sidebar
          navItems={adminNavItems}
          activeItem={sidebarActive}
          onNavigate={handleSidebarNavigate}
          studentName={adminName}
          avatarUrl={avatarUrl}
          roleLabel="Admin"
          notifications={{}}
        />

        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={title}
            userName={adminName}
            avatarUrl={avatarUrl}
            notifications={adminNotifications}
            onProfileClick={() => setExtraView('profile')}
            onSettingsClick={() => setExtraView('settings')}
          />

          {extraView === 'profile' ? (
            <AdminProfileCard
              name={adminName}
              email={userDetails?.email as string | undefined}
              avatarUrl={avatarUrl}
            />
          ) : extraView === 'settings' ? (
            <div className="h-[calc(100vh-56px)] overflow-y-auto bg-wl-page">
              <StudentSettings />
            </div>
          ) : section === 'chat' ? (
            <AdminChat />
          ) : (
            mainScroll
          )}

          {section !== 'chat' ? <Chatbot /> : null}
        </main>
      </div>
    </div>
  );
}
