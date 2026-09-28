import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  Lock,
  Presentation,
  Search,
  Send,
  Star,
  UserCheck,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react';

export type BadgeTone = 'brand' | 'neutral' | 'amber' | 'inverse';

export const PRICING_EYEBROW = 'How pricing works';

export const PRICING_TRUST_LINE = "You're charged only after your expert accepts your request.";

export const RATES_CARD = {
  title: 'Expert-set rates',
  badge: { label: 'Transparent pricing', tone: 'brand' as BadgeTone },
  body: 'Each expert sets their own rates.',
  options: [
    { id: 'consultations', icon: UserRound, title: '1:1 Consultations', rate: 'Hourly rate', note: 'Set by each expert' },
    { id: 'seminars', icon: Presentation, title: 'Seminars', rate: 'Per-seminar price', note: 'Set for each seminar' },
  ] satisfies { id: string; icon: LucideIcon; title: string; rate: string; note: string }[],
  footer: 'Compare expertise, availability, and rates.',
  footerLink: 'Browse experts',
};

export const RESCHEDULING_CARD = {
  title: 'Flexible rescheduling',
  badge: { label: 'No pressure', tone: 'neutral' as BadgeTone },
  body: 'Request a different time. Changes take effect after expert approval — no automatic cancellations.',
  /** Remove once rescheduling ships. */
  comingSoon: true,
};

export const GRATUITY_CARD = {
  title: 'Client gratuity',
  badge: { label: 'Optional', tone: 'neutral' as BadgeTone },
  body: "For high-demand experts, you may add a custom tip on top of the session rate. It's entirely optional — a way to show appreciation or secure a preferred slot.",
  /** Remove once gratuity ships. */
  comingSoon: true,
};

export const RATINGS_CARD = {
  title: 'Two-way ratings',
  badge: { label: 'Community standard', tone: 'amber' as BadgeTone },
  body: 'Clients rate experts. Experts rate clients. Mutual feedback helps maintain a professional community.',
  rows: ['Expert → Client', 'Client → Expert'],
};

export type JourneyStep = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  highlight?: boolean;
};

export const JOURNEY_CARD = {
  eyebrow: 'From request to consultation',
  title: 'Request first. Pay only when accepted.',
  note: "If your expert declines, you won't be charged.",
  subtext: 'Six simple steps, and you only pay once your expert says yes.',
  steps: [
    { id: 'find', label: 'Find expert', description: 'Browse by field and rate', icon: Search },
    { id: 'request', label: 'Request', description: 'Pick a time and share your goals', icon: Send },
    { id: 'accept', label: 'Expert accepts', description: 'Reviewed and confirmed', icon: UserCheck, highlight: true },
    { id: 'pay', label: 'Pay', description: 'Charged only after acceptance', icon: CreditCard, highlight: true },
    { id: 'meet', label: 'Meet', description: 'Your 1:1 session or seminar', icon: Video },
    { id: 'rate', label: 'Rate', description: 'Leave feedback for each other', icon: Star },
  ] satisfies JourneyStep[],
};

export const GUARANTEES: { icon: LucideIcon; iconClass: string; title: string; text: string }[] = [
  {
    icon: CheckCircle,
    iconClass: 'bg-emerald-50 text-emerald-600',
    title: 'No charge if declined',
    text: 'You only pay once your expert accepts your request.',
  },
  {
    icon: Lock,
    iconClass: 'bg-slate-100 text-slate-700',
    title: 'Secure payments',
    text: 'All transactions are encrypted and processed securely.',
  },
  {
    icon: Calendar,
    iconClass: 'bg-sky-50 text-sky-700',
    title: 'Appointment-only',
    text: 'No on-demand or drop-in sessions; every meeting is scheduled with purpose.',
  },
  {
    icon: AlertCircle,
    iconClass: 'bg-amber-50 text-amber-700',
    title: 'Complaint resolution',
    text: 'Issues are reviewed and responded to within 5 business days.',
  },
];
