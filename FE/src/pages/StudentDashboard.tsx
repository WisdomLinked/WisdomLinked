import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BookOpen, Clock, UserCheck, AlertCircle, MessageSquare } from 'lucide-react';
import { useAppSelector } from '../store';
import { doGetMyEvents, profileImageFetch } from '../api/api';
import { fetchDmUnreadSnapshot } from '../api/chatApi';
import Sidebar from '../components/layout/Sidebar';
import TopBar, { TopBarNotificationItem } from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection from '../components/dashboard/CarouselSection';
import StudentProfile from '../components/dashboard/StudentProfile';
import StudentSettings from '../components/dashboard/StudentSettings';
import StudentCalendar from '../components/dashboard/StudentCalendar';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StudentSeminars from '../components/dashboard/StudentSeminars';
import FindExpertsPage from './FindExperts';
import Chatbot from '../components/chatbot';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import UpcomingCountdownCard from '../components/dashboard/UpcomingCountdownCard';
import UpcomingSessionModal from '../components/dashboard/UpcomingSessionModal';
import ExpertProfile from '../components/dashboard/ExpertProfile';
import StudentChat from '../components/dashboard/StudentChat';
import type { MentorCardProps } from '../components/MentorCard';
import {
  connectToRC,
  onSubscriptionChanged,
  subscribeToRoom,
} from '../services/rcRealtime';

function deriveSessionCounts(u: any) {
  if (!u) {
    return { bookedSem: 0, pendSem: 0, bookedInd: 0, pendInd: 0 };
  }
  const events = u.events || [];
  const pendInd = events.filter(
    (e: any) => (e.status || '').toLowerCase() === 'pending',
  ).length;
  const bookedInd = events.filter((e: any) => {
    const s = (e.status || '').toLowerCase();
    return s === 'accepted' || s === 'confirmed' || s === 'approved';
  }).length;
  const gcs = u.groupChats || [];
  const bookedSem = gcs.filter((g: any) => g.type === 'seminar').length;
  const pendSem = (u.pendingGroupChats || []).filter(
    (p: any) => p.groupChatId?.type === 'seminar',
  ).length;
  return { bookedSem, pendSem, bookedInd, pendInd };
}

export default function StudentDashboard() {
  const dispatch = useDispatch();
  const [activeItem, setActiveItem] = useState('dashboard');
  const [dmUnreadByRid, setDmUnreadByRid] = useState<Record<string, number>>({});
  const [selectedExpert, setSelectedExpert] = useState<MentorCardProps | null>(null);
  const [followedMentorIds, setFollowedMentorIds] = useState<string[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [sessionStats, setSessionStats] = useState({
    bookedSem: 0,
    pendSem: 0,
    bookedInd: 0,
    pendInd: 0,
  });

  const toggleExpertFollow = useCallback((mentorId: string | number) => {
    const id = String(mentorId);
    setFollowedMentorIds(prev => {
      const isFollowing = prev.includes(id);
      setFollowerCounts(fc => ({
        ...fc,
        [id]: (fc[id] ?? 0) + (isFollowing ? -1 : 1),
      }));
      return isFollowing ? prev.filter(x => x !== id) : [...prev, id];
    });
  }, []);
  const [upcomingModal, setUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
  } | null>(null);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const cards = useMemo(
    () =>
      [
        {
          id: 'booked-seminars',
          label: 'Booked seminar sessions',
          value: sessionStats.bookedSem,
          icon: BookOpen,
          color: 'success' as const,
          onClick: () => setUpcomingModal({ kind: 'seminar', status: 'booked' }),
        },
        {
          id: 'pending-seminars',
          label: 'Pending seminar sessions',
          value: sessionStats.pendSem,
          icon: Clock,
          color: 'neutral' as const,
          tooltip: 'Pending seminar – awaiting approval',
          onClick: () => setUpcomingModal({ kind: 'seminar', status: 'pending' }),
        },
        {
          id: 'booked-individual',
          label: 'Booked individual sessions',
          value: sessionStats.bookedInd,
          icon: UserCheck,
          color: 'success' as const,
          onClick: () =>
            setUpcomingModal({ kind: 'oneToOne', status: 'booked' }),
        },
        {
          id: 'pending-individual',
          label: 'Pending individual sessions',
          value: sessionStats.pendInd,
          icon: AlertCircle,
          color: 'neutral' as const,
          tooltip: 'Pending 1:1 session – to be approved',
          onClick: () =>
            setUpcomingModal({ kind: 'oneToOne', status: 'pending' }),
        },
      ] as const,
    [sessionStats],
  );

  const { auth: { userDetails } } = useAppSelector((state: any) => state);
  const studentName =
    (userDetails?.username as string | undefined) ||
    (userDetails?.name as string | undefined) ||
    'Student';
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const image = userDetails?.image as string | undefined;
    if (!image) {
      setAvatarUrl(undefined);
      return;
    }
    profileImageFetch(image, 'small')
      .then((img: any) => {
        if (typeof img === 'string') setAvatarUrl(img);
        else setAvatarUrl(undefined);
      })
      .catch(() => setAvatarUrl(undefined));
  }, [userDetails?.image]);

  useEffect(() => {
    if (activeItem !== 'chat') return;
  }, [activeItem]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res: any = await doGetMyEvents();
      if (!res?.result || cancelled) return;
      dispatch({ type: 'updateUserDetails', payload: res.result });
      setSessionStats(deriveSessionCounts(res.result));
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      await connectToRC();
      const snapshot = await fetchDmUnreadSnapshot();
      if (!mounted) return;
      if (snapshot?.success && snapshot.unreadByRid) {
        setDmUnreadByRid(snapshot.unreadByRid);
      } else {
        setDmUnreadByRid({});
      }
    };
    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const dcs = userDetails?.directConversations ?? [];
    dcs.forEach((conv: any) => {
      if (conv?.rcChannelId) subscribeToRoom(String(conv.rcChannelId));
    });
  }, [userDetails?.directConversations]);

  const dmNameByRid = useMemo(() => {
    const out: Record<string, string> = {};
    const meId = String(userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? '');
    const dcs = userDetails?.directConversations ?? [];
    dcs.forEach((conv: any) => {
      const rid = String(conv?.rcChannelId || '');
      if (!rid) return;
      const participants = Array.isArray(conv?.participants) ? conv.participants : [];
      const other = participants.find(
        (p: any) => String(p?._id ?? p?.id ?? '') && String(p?._id ?? p?.id ?? '') !== meId,
      );
      const fullName = String(other?.username || other?.name || other?.email || '').trim();
      if (fullName) out[rid] = fullName;
    });
    return out;
  }, [userDetails?._id, userDetails?.id, userDetails?.userId, userDetails?.directConversations]);

  useEffect(() => {
    const unsubSub = onSubscriptionChanged(({ roomId, type, unread }) => {
      if (type && type !== 'd') return;
      const rid = String(roomId || '');
      if (!rid) return;
      const nextUnread = Number(unread || 0);
      setDmUnreadByRid(prev => {
        const next = { ...prev };
        if (nextUnread > 0) next[rid] = nextUnread;
        else delete next[rid];
        return next;
      });
    });
    return () => {
      unsubSub();
    };
  }, [userDetails?.email]);

  const totalUnreadDm = useMemo(
    () => Object.values(dmUnreadByRid).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [dmUnreadByRid],
  );
  const chatNotifications = useMemo<TopBarNotificationItem[]>(
    () =>
      Object.entries(dmUnreadByRid)
        .filter(([, count]) => Number(count) > 0)
        .map(([rid, count]) => {
          const n = Number(count) || 0;
          const senderLabel = dmNameByRid[rid] || 'Someone';
          return {
            id: `dm-${rid}`,
            title: `${senderLabel} messaged you`,
            meta: `${n > 99 ? '99+' : n} unread message${n > 1 ? 's' : ''}`,
            icon: <MessageSquare className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />,
            onClick: () => {
              localStorage.setItem('wl_open_dm_rid', rid);
              setActiveItem('chat');
            },
          };
        }),
    [dmUnreadByRid, dmNameByRid],
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={setActiveItem}
          studentName={studentName}
          avatarUrl={avatarUrl}
          notifications={{ chat: totalUnreadDm }}
        />
        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={
              activeItem === 'profile'
                ? 'Profile'
                : activeItem === 'expert-profile'
                  ? 'Expert Profile'
                : activeItem === 'settings'
                  ? 'Settings'
                : activeItem === 'contact-admin'
                  ? 'Contact admin'
                : activeItem === 'experts'
                  ? 'Find experts'
                  : activeItem === 'calendar'
                    ? 'Calendar'
                    : activeItem === 'join-meeting'
                      ? 'Join meeting'
                      : activeItem === 'seminars'
                        ? 'Seminars'
                        : 'Student Dashboard'
            }
            userName={studentName}
            avatarUrl={avatarUrl}
            onProfileClick={() => setActiveItem('profile')}
            onSettingsClick={() => setActiveItem('settings')}
            notifications={chatNotifications}
            notificationsEnabled={activeItem !== 'chat'}
          />
          {activeItem === 'chat' ? (
            <div className="h-[calc(100vh-56px)] bg-wl-chatGold">
              <StudentChat />
            </div>
          ) : activeItem === 'profile' ? (
            <StudentProfile />
          ) : activeItem === 'settings' ? (
            <StudentSettings />
          ) : activeItem === 'expert-profile' ? (
            selectedExpert ? (
              <ExpertProfile
                mentor={selectedExpert}
                followerCount={
                  followerCounts[String(selectedExpert.id)] ??
                  selectedExpert.followerCount ??
                  0
                }
                isFollowing={followedMentorIds.includes(String(selectedExpert.id))}
                onToggleFollow={toggleExpertFollow}
                onBack={() => setActiveItem('experts')}
              />
            ) : (
              <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] p-6">
                <p className="text-sm text-slate-500">No expert selected.</p>
              </div>
            )
          ) : activeItem === 'experts' ? (
            <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
              <FindExpertsPage
                followedMentorIds={followedMentorIds}
                followerCounts={followerCounts}
                onToggleFollow={toggleExpertFollow}
                onViewExpert={mentor => {
                  setSelectedExpert(mentor);
                  setActiveItem('expert-profile');
                }}
              />
            </div>
          ) : activeItem === 'calendar' ? (
            <StudentCalendar onJoinMeeting={() => setActiveItem('join-meeting')} />
          ) : activeItem === 'join-meeting' ? (
            <JoinMeeting />
          ) : activeItem === 'contact-admin' ? (
            <ContactAdmin />
          ) : activeItem === 'seminars' ? (
            <StudentSeminars />
          ) : (
            <div className="px-6 py-7">
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                <section className="min-w-0">
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {greeting}, {studentName.split(' ')[0]}!
                  </h2>
                  <p className="mt-1 max-w-xl font-sans text-[13px] text-slate-500">
                    Here&apos;s what&apos;s happening with your WisdomLinked sessions today.
                  </p>
                  <StatsGrid cards={cards} />
                </section>

                <div className="hidden lg:block">
                  <div className="mt-16">
                    <UpcomingCountdownCard
                      onJoinSeminar={() => setActiveItem('join-meeting')}
                      onJoinOneToOne={() => setActiveItem('join-meeting')}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 lg:hidden">
                <UpcomingCountdownCard
                  onJoinSeminar={() => setActiveItem('join-meeting')}
                  onJoinOneToOne={() => setActiveItem('join-meeting')}
                />
              </div>

              <CarouselSection />
            </div>
          )}
          {activeItem !== 'chat' && activeItem !== 'profile' ? <Chatbot /> : null}
        </main>
        {upcomingModal && (
          <UpcomingSessionModal
            kind={upcomingModal.kind}
            status={upcomingModal.status}
            onClose={() => setUpcomingModal(null)}
            onJoin={() => {
              setUpcomingModal(null);
              setActiveItem('join-meeting');
            }}
          /> 
        )}
      </div>
    </div>
  );
}
