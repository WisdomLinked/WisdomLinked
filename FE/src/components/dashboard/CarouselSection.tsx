import React from 'react';
import { Users, BookOpen, Lightbulb, Globe2 } from 'lucide-react';
import CarouselCard from '../ui/CarouselCard';

type Section = {
  id: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  items: Array<{
    sectionTitle: string;
    title: string;
    description: string;
    tag?: string;
    metaLabel?: string;
    experience?: string;
    location?: string;
    cta: string;
    image?: string;
  }>;
};

const sections: Section[] = [
  {
    id: 'experts',
    category: 'Expert',
    icon: Users,
    items: [
      {
        sectionTitle: 'New Experts',
        title: 'Dr. Emily Chen',
        description:
          'Highway safety, traffic planning, and applied AI for autonomous mobility.',
        tag: 'New expert',
        metaLabel: 'Experience',
        experience: '8 years',
        location: 'San Francisco, CA',
        cta: 'View profile',
        image:
          'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'New Experts',
        title: 'Prof. Daniel Ortiz',
        description:
          'Urban traffic optimization, congestion modeling, and public transit design.',
        tag: 'New expert',
        metaLabel: 'Experience',
        experience: '12 years',
        location: 'Madrid, Spain',
        cta: 'View profile',
        image:
          'https://images.pexels.com/photos/2406395/pexels-photo-2406395.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'New Experts',
        title: 'Dr. Aisha Rahman',
        description:
          'Road safety analytics, human factors engineering, and policy impact evaluation.',
        tag: 'New expert',
        metaLabel: 'Experience',
        experience: '9 years',
        location: 'Dubai, UAE',
        cta: 'View profile',
        image:
          'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
    ],
  },
  {
    id: 'seminars',
    category: 'Seminar',
    icon: BookOpen,
    items: [
      {
        sectionTitle: 'Seminars tailored to your interests',
        title: 'AI in Healthcare — Live Seminar',
        description:
          'Design safe clinical AI systems using real hospital workflows and case studies.',
        tag: 'Seminar',
        metaLabel: 'Session time',
        experience: '90 minutes',
        location: 'Online · This Friday',
        cta: 'Register seat',
        image:
          'https://images.pexels.com/photos/1181345/pexels-photo-1181345.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Seminars tailored to your interests',
        title: 'Systems Design for Scale',
        description:
          'Architect services that handle millions of users with practical whiteboard exercises.',
        tag: 'Seminar',
        metaLabel: 'Session time',
        experience: '2 hours',
        location: 'Online · Next Wednesday',
        cta: 'Reserve spot',
        image:
          'https://images.pexels.com/photos/1181670/pexels-photo-1181670.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Seminars tailored to your interests',
        title: 'Data Structures Deep Dive',
        description:
          'Hands-on seminar walking through trees, graphs, and advanced data structures in practice.',
        tag: 'Seminar',
        metaLabel: 'Session time',
        experience: '3 hours',
        location: 'Online · This Saturday',
        cta: 'Join waitlist',
        image:
          'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Seminars tailored to your interests',
        title: 'Writing Impactful Research Statements',
        description:
          'Learn how to position your work for graduate school and fellowship applications.',
        tag: 'Seminar',
        metaLabel: 'Session time',
        experience: '75 minutes',
        location: 'Campus · Lab A3',
        cta: 'Save a seat',
        image:
          'https://images.pexels.com/photos/4144222/pexels-photo-4144222.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Seminars tailored to your interests',
        title: 'Career Strategy for Early Researchers',
        description:
          'Navigate academia vs. industry with frameworks, case studies, and live Q&A.',
        tag: 'Seminar',
        metaLabel: 'Session time',
        experience: '60 minutes',
        location: 'Online · This Sunday',
        cta: 'Register free',
        image:
          'https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
    ],
  },
  {
    id: 'research',
    category: 'Research',
    icon: Lightbulb,
    items: [
      {
        sectionTitle: 'Research Opportunities',
        title: 'Climate Tech Research Fellowship',
        description:
          'Model resilient energy systems with a cross-disciplinary faculty advisory group.',
        tag: 'Research',
        metaLabel: 'Program length',
        experience: '6 months',
        location: 'Hybrid · Global teams',
        cta: 'View details',
        image:
          'https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Research Opportunities',
        title: 'Behavioral Data Science Lab',
        description:
          'Collaborate on experiments measuring decision making under uncertainty.',
        tag: 'Research',
        metaLabel: 'Program length',
        experience: '1 academic term',
        location: 'On‑campus · Limited seats',
        cta: 'See call',
        image:
          'https://images.pexels.com/photos/3735761/pexels-photo-3735761.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Research Opportunities',
        title: 'Human–AI Collaboration Lab',
        description:
          'Run user studies exploring how people interact with copilots and recommendation systems.',
        tag: 'Research',
        metaLabel: 'Program length',
        experience: '2 academic terms',
        location: 'On‑campus · UX Lab',
        cta: 'Express interest',
        image:
          'https://images.pexels.com/photos/1181355/pexels-photo-1181355.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Research Opportunities',
        title: 'Sustainable Mobility Studio',
        description:
          'Prototype and evaluate interventions to reduce congestion and improve road safety.',
        tag: 'Research',
        metaLabel: 'Program length',
        experience: '1 semester',
        location: 'Hybrid · City partner',
        cta: 'View brief',
        image:
          'https://images.pexels.com/photos/799443/pexels-photo-799443.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Research Opportunities',
        title: 'Applied Machine Learning Clinic',
        description:
          'Work with partner organizations to deploy ML models on real, messy datasets.',
        tag: 'Research',
        metaLabel: 'Program length',
        experience: '10 weeks',
        location: 'Remote · Global',
        cta: 'Apply',
        image:
          'https://images.pexels.com/photos/3861964/pexels-photo-3861964.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
    ],
  },
  {
    id: 'opportunities',
    category: 'Opportunity',
    icon: Globe2,
    items: [
      {
        sectionTitle: 'Other available seminars',
        title: 'Intro to Behavioral Economics',
        description:
          'Learn the foundations of decision science with weekly project reviews.',
        tag: 'Seminar',
        metaLabel: 'Seats left',
        experience: '42',
        location: 'Online · Next week',
        cta: 'Reserve seat',
        image:
          'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Other available seminars',
        title: 'Product Thinking for Engineers',
        description:
          'Strengthen your product sense with real case walkthroughs and critique sessions.',
        tag: 'Seminar',
        metaLabel: 'Cohort size',
        experience: 'Limited',
        location: 'Remote · Evening cohort',
        cta: 'Apply now',
        image:
          'https://images.pexels.com/photos/1181298/pexels-photo-1181298.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Other available seminars',
        title: 'Intro to Quantitative UX',
        description:
          'Learn metrics, experiment design, and dashboards that matter for product teams.',
        tag: 'Seminar',
        metaLabel: 'Seats left',
        experience: '18',
        location: 'Online · Self-paced',
        cta: 'Start now',
        image:
          'https://images.pexels.com/photos/1181275/pexels-photo-1181275.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Other available seminars',
        title: 'Writing for Technical Leaders',
        description:
          'Sharpen your long-form memos and strategy docs with guided reviews.',
        tag: 'Seminar',
        metaLabel: 'Cohort size',
        experience: 'Small group',
        location: 'Online · Evening cohort',
        cta: 'Join cohort',
        image:
          'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        sectionTitle: 'Other available seminars',
        title: 'Communicating Research to Non‑Experts',
        description:
          'Practice translating complex work into clear narratives for broad audiences.',
        tag: 'Seminar',
        metaLabel: 'Seats left',
        experience: '25',
        location: 'Campus · Auditorium 2',
        cta: 'Reserve invite',
        image:
          'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
    ],
  },
];

export default function CarouselSection() {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            What's New For You
          </h2>
          <p className="text-sm text-slate-500">
            Personalized updates and opportunities based on your activity.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map(section => (
          <CarouselCard
            key={section.id}
            category={section.category}
            icon={section.icon}
            items={section.items}
          />
        ))}
      </div>
    </section>
  );
}

