import { Link } from 'react-router-dom';
import { ArrowRight, Award, GraduationCap, IdCard, ListChecks, type LucideIcon } from 'lucide-react';
import { NAVY_BAND_CLASS } from './Container';

type ResourceCategory = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Section on the Resources timeline or guides page. */
  href: string;
};

/** Icons match the ones the Resources timeline and guides pages use for the same content. */
const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: 'shortlist-programs',
    label: 'Shortlist programs',
    description: 'Find your best fit',
    icon: ListChecks,
    href: '/resources#shortlist-programs',
  },
  {
    id: 'graduate-school-guide',
    label: 'Application guide',
    description: 'SOPs and references',
    icon: GraduationCap,
    href: '/resources/guides#graduate-school-guide',
  },
  {
    id: 'scholarship-guide',
    label: 'Scholarships',
    description: 'Find and win funding',
    icon: Award,
    href: '/resources/guides#scholarship-guide',
  },
  {
    id: 'student-visa',
    label: 'Student visa',
    description: 'F-1 step by step',
    icon: IdCard,
    href: '/resources#student-visa',
  },
];

const HEADING_ID = 'home-resources-heading';

const FOCUS_RING_ON_NAVY =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#234C6A]';

export default function ResourcesBand() {
  return (
    <section aria-labelledby={HEADING_ID} className={`${NAVY_BAND_CLASS} px-5 py-8 sm:px-6 md:px-10 md:py-9`}>
      <header className="mb-7 text-center md:mb-8">
        <p className="section-label tracking-widest text-white/70">Resources</p>
        <h2 id={HEADING_ID} className="mt-2 font-display text-xl font-bold md:text-2xl">
          Plan every step toward grad school.
        </h2>
        <p className="mt-2 text-[15px] text-white/75 md:text-base">
          Free guides for applying to graduate study in the U.S.
        </p>
      </header>

      <ul className="flex flex-wrap justify-center gap-y-6">
        {RESOURCE_CATEGORIES.map(({ id, label, description, icon: Icon, href }) => (
          <li key={id} className="w-1/2 px-1.5 sm:px-2 lg:w-1/4">
            <Link
              to={href}
              aria-labelledby={`home-resources-${id}-label`}
              aria-describedby={`home-resources-${id}-description`}
              className={`group flex h-full flex-col items-center gap-3 rounded-xl px-1 py-2 text-center ${FOCUS_RING_ON_NAVY}`}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 group-hover:bg-white group-hover:text-[#234C6A] group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.25)] group-focus-visible:bg-white group-focus-visible:text-[#234C6A]"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span id={`home-resources-${id}-label`} className="block text-sm font-semibold text-white md:text-base">
                  {label}
                </span>
                <span id={`home-resources-${id}-description`} className="mt-1 block text-sm leading-relaxed text-white/70">
                  {description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-7 border-t border-white/15 pt-5 text-center">
        <Link
          to="/resources"
          className={`group inline-flex items-center gap-1.5 rounded text-sm font-semibold text-white/90 hover:text-white hover:underline ${FOCUS_RING_ON_NAVY}`}
        >
          Browse all resources
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
