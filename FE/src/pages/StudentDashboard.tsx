import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock, UserCheck, AlertCircle } from 'lucide-react';
import { useAppSelector } from '../store';
import { profileImageFetch } from '../api/api';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection from '../components/dashboard/CarouselSection';
import StudentChat from '../components/dashboard/StudentChat';
import StudentProfile from '../components/dashboard/StudentProfile';
import StudentSettings from '../components/dashboard/StudentSettings';
import StudentCalendar from '../components/dashboard/StudentCalendar';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StudentSeminars from '../components/dashboard/StudentSeminars';
import FindExpertsPage, { INITIAL_FOLLOWER_COUNTS } from './FindExperts';
import Chatbot from '../components/chatbot';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import UpcomingCountdownCard from '../components/dashboard/UpcomingCountdownCard';
import UpcomingSessionModal from '../components/dashboard/UpcomingSessionModal';
import ExpertProfile from '../components/dashboard/ExpertProfile';
import type { MentorCardProps } from '../components/MentorCard';

export default function StudentDashboard() {
  const [activeItem, setActiveItem] = useState('dashboard');
  // Dummy unread indicator for sidebar showcase; replace with backend unread count later.
  const [hasNewChatMessage, setHasNewChatMessage] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<MentorCardProps | null>(null);
  const [followedMentorIds, setFollowedMentorIds] = useState<number[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<number, number>>(
    () => ({ ...INITIAL_FOLLOWER_COUNTS }),
  );

  const toggleExpertFollow = useCallback((mentorId: number) => {
    setFollowedMentorIds((prev: number[]) => {
      const isFollowing = prev.includes(mentorId);
      setFollowerCounts((fc: Record<number, number>) => ({
        ...fc,
        [mentorId]:
          (fc[mentorId] ?? INITIAL_FOLLOWER_COUNTS[mentorId] ?? 0) +
          (isFollowing ? -1 : 1),
      }));
      return isFollowing
        ? prev.filter((id: number) => id !== mentorId)
        : [...prev, mentorId];
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

  const cards: Array<{
    id: string;
    label: string;
    value: number;
    trend?: string;
    subline?: string;
    tooltip?: string;
    icon: typeof BookOpen;
    color: 'primary' | 'success' | 'warning' | 'neutral';
    onClick?: () => void;
  }> = [
    {
      id: 'booked-seminars',
      label: 'Booked seminar sessions',
      value: 8,
      trend: '+12% this week',
      subline: undefined,
      icon: BookOpen,
      color: 'success',
      onClick: () => setUpcomingModal({ kind: 'seminar', status: 'booked' }),
    },
    {
      id: 'pending-seminars',
      label: 'Pending seminar sessions',
      value: 3,
      icon: Clock,
      color: 'neutral',
      tooltip: 'Pending seminar – awaiting approval',
      onClick: () => setUpcomingModal({ kind: 'seminar', status: 'pending' }),
    },
    {
      id: 'booked-individual',
      label: 'Booked individual sessions',
      value: 5,
      trend: '+8% this week',
      subline: undefined,
      icon: UserCheck,
      color: 'success',
      onClick: () =>
        setUpcomingModal({ kind: 'oneToOne', status: 'booked' }),
    },
    {
      id: 'pending-individual',
      label: 'Pending individual sessions',
      value: 2,
      icon: AlertCircle,
      color: 'neutral',
      tooltip: 'Pending 1:1 session – to be approved',
      onClick: () =>
        setUpcomingModal({ kind: 'oneToOne', status: 'pending' }),
    },
  ];

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
    if (activeItem === 'chat') {
      setHasNewChatMessage(false);
    }
  }, [activeItem]);

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={setActiveItem}
          studentName={studentName}
          avatarUrl={avatarUrl}
          notifications={{ chat: hasNewChatMessage }}
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
          />
          {activeItem === 'chat' ? (
            <div className="h-[calc(100vh-56px)]">
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
                  followerCounts[selectedExpert.id] ??
                  selectedExpert.followerCount ??
                  0
                }
                isFollowing={followedMentorIds.includes(selectedExpert.id)}
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
