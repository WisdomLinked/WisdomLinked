import React, { useMemo, useState } from 'react';
import { BookOpen, Clock, UserCheck, AlertCircle } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection from '../components/dashboard/CarouselSection';
import StudentChat from '../components/dashboard/StudentChat';
import StudentProfile from '../components/dashboard/StudentProfile';
import StudentCalendar from '../components/dashboard/StudentCalendar';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StudentSeminars from '../components/dashboard/StudentSeminars';
import FindExpertsPage from './FindExperts';
import Chatbot from '../components/chatbot';
import UpcomingCountdownCard from '../components/dashboard/UpcomingCountdownCard';
import UpcomingSessionModal from '../components/dashboard/UpcomingSessionModal';

export default function StudentDashboard() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [upcomingModalKind, setUpcomingModalKind] = useState<'seminar' | 'oneToOne' | null>(null);
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
      onClick: () => setUpcomingModalKind('seminar'),
    },
    {
      id: 'pending-seminars',
      label: 'Pending seminar sessions',
      value: 3,
      icon: Clock,
      color: 'neutral',
      tooltip: 'Pending seminar – awaiting approval',
    },
    {
      id: 'booked-individual',
      label: 'Booked individual sessions',
      value: 5,
      trend: '+8% this week',
      subline: undefined,
      icon: UserCheck,
      color: 'success',
      onClick: () => setUpcomingModalKind('oneToOne'),
    },
    {
      id: 'pending-individual',
      label: 'Pending individual sessions',
      value: 2,
      icon: AlertCircle,
      color: 'neutral',
      tooltip: 'Pending 1:1 session – to be approved',
    },
  ];

  const studentName = 'Alex Rivera';

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={setActiveItem}
          studentName={studentName}
        />
        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={
              activeItem === 'profile'
                ? 'Profile'
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
          />
          {activeItem === 'chat' ? (
            <div className="h-[calc(100vh-56px)]">
              <StudentChat />
            </div>
          ) : activeItem === 'profile' ? (
            <StudentProfile />
          ) : activeItem === 'experts' ? (
            <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
              <FindExpertsPage />
            </div>
          ) : activeItem === 'calendar' ? (
            <StudentCalendar />
          ) : activeItem === 'join-meeting' ? (
            <JoinMeeting />
          ) : activeItem === 'seminars' ? (
            <StudentSeminars />
          ) : (
            <div className="px-6 py-7">
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                <section className="min-w-0">
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {greeting}, {studentName.split(' ')[0]} 👋
                  </h2>
                  <p className="mt-1 max-w-xl font-sans text-[13px] text-slate-500">
                    Here&apos;s what&apos;s happening with your WisdomLinked sessions today.
                  </p>
                  <StatsGrid cards={cards} />
                </section>

                <div className="hidden lg:block">
                  <div className="mt-16">
                    <UpcomingCountdownCard />
                  </div>
                </div>
              </div>

              <div className="mt-6 lg:hidden">
                <UpcomingCountdownCard />
              </div>

              <CarouselSection />
            </div>
          )}
          {activeItem !== 'chat' && activeItem !== 'profile' ? <Chatbot /> : null}
        </main>
        {upcomingModalKind && (
          <UpcomingSessionModal
            kind={upcomingModalKind}
            onClose={() => setUpcomingModalKind(null)}
            onJoin={() => {
              setUpcomingModalKind(null);
              setActiveItem('join-meeting');
            }}
          /> 
        )}
      </div>
    </div>
  );
}
