import React, { useState } from 'react';
import { BookOpen, Clock, UserCheck, AlertCircle } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection from '../components/dashboard/CarouselSection';

export default function StudentDashboard() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const cards = [
    {
      id: 'booked-seminars',
      label: 'Booked seminar sessions',
      value: 8,
      trend: '+12% this week',
      icon: BookOpen,
      color: 'success',
    },
    {
      id: 'pending-seminars',
      label: 'Pending seminar sessions',
      value: 3,
      icon: Clock,
      color: 'neutral',
    },
    {
      id: 'booked-individual',
      label: 'Booked individual sessions',
      value: 5,
      trend: '+8% this week',
      icon: UserCheck,
      color: 'success',
    },
    {
      id: 'pending-individual',
      label: 'Pending individual sessions',
      value: 2,
      icon: AlertCircle,
      color: 'neutral',
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
          <TopBar title="Student Dashboard" userName={studentName} />
          <div className="px-6 py-7">
            <section>
              <p className="mb-1 text-[10px] font-bold tracking-[0.18em] text-[#234c6a] uppercase">
                Student view
              </p>
              <h2 className="text-3xl font-semibold text-slate-900">
                {greeting}, {studentName.split(' ')[0]} 👋
              </h2>
              <p className="mt-1 max-w-xl font-sans text-[13px] text-slate-500">
                Here&apos;s what&apos;s happening with your WisdomLinked sessions today.
              </p>
              <StatsGrid cards={cards} />
            </section>

            <CarouselSection />
          </div>
        </main>
      </div>
    </div>
  );
}
