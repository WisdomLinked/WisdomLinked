/** Inline text with optional external links, so copy stays editable without JSX. */
export type RichText = (string | { text: string; href: string })[];

export type StageIcon = 'list-checks' | 'user-search' | 'pencil-line' | 'file-text' | 'wallet' | 'id-card' | 'plane';

export type ResourceLink = { monogram: string; name: string; description: string; source: string; href: string };
export type Exam = { category: string; name: string; description: string };
export type GuidePreview = { title: string; description: string };
export type Step = { title: string; description: string };
export type ExpertPromoContent = { label: string; heading: string; text: string; cta: string };

export type StageBody =
  | { type: 'links'; items: ResourceLink[] }
  | { type: 'exams'; items: Exam[] }
  | { type: 'guides'; items: GuidePreview[]; footnote: string }
  | { type: 'steps'; items: Step[]; note?: RichText }
  | { type: 'expertPromo'; promo: ExpertPromoContent };

export type TimelineStage = {
  id: string;
  number: number;
  icon: StageIcon;
  timeRange: string;
  /** Months relative to the program start (0); the plan chart spans -18 to 0. */
  monthsFrom: number;
  monthsTo: number;
  title: string;
  keyFact: { value: string; caption: string };
  intro: RichText;
  body?: StageBody[];
};

export const PLAN_MONTHS = 18;

export const RESOURCES_HEADER = {
  eyebrow: 'Resources',
  heading: 'Your path to graduate study in the U.S.',
  subtext:
    'What to do and when, from your first shortlist to your first week on campus. Seven stages over about eighteen months, with the official sources for each.',
  startCta: 'Start with stage 1',
  expertCta: 'Talk to an expert',
  timelineLabel: 'Your timeline',
};

export const PLAN_CHART = {
  ariaLabel: '18-month plan',
  title: 'Your 18-month plan',
  note: 'For a fall start',
  axis: ['Mar', 'Jun', 'Sep', 'Dec', 'Mar', 'Jun', 'Start'],
};

export const RESOURCES_CLOSING = {
  heading: "Have a question that isn't covered here?",
  text: 'Ask an expert who studied or teaches at a U.S. university.',
  cta: 'Ask an expert',
};

export const GUIDES_CTA = {
  loggedOut: 'Log in to see all guides',
  loggedIn: 'See all guides',
};

const WISDOMLINKED = 'WisdomLinked';

export const RESOURCES_TIMELINE: TimelineStage[] = [
  {
    id: 'shortlist-programs',
    number: 1,
    icon: 'list-checks',
    timeRange: '18–12 months before',
    monthsFrom: -18,
    monthsTo: -12,
    title: 'Shortlist programs',
    keyFact: { value: '6–10', caption: 'programs on a balanced list' },
    intro: [
      'Rank the department, not the university. A school with three active faculty in your area is a better fit than a famous one with none.',
    ],
    body: [
      {
        type: 'links',
        items: [
          {
            monogram: 'DOS',
            name: 'EducationUSA',
            description: "The U.S. government's guide to choosing a program",
            source: 'U.S. Dept. of State',
            href: 'https://educationusa.state.gov/your-5-steps-us-study/research-your-options',
          },
          {
            monogram: 'DHS',
            name: 'SEVP School Search',
            description: 'Confirm a school can enroll international students',
            source: 'Homeland Security',
            href: 'https://studyinthestates.dhs.gov/school-search',
          },
          {
            monogram: 'ED',
            name: 'College Navigator',
            description: 'Tuition, accreditation and enrollment data',
            source: 'U.S. Dept. of Education',
            href: 'https://nces.ed.gov/collegenavigator/',
          },
        ],
      },
    ],
  },
  {
    id: 'find-a-supervisor',
    number: 2,
    icon: 'user-search',
    timeRange: '15–9 months before',
    monthsFrom: -15,
    monthsTo: -9,
    title: 'Find a supervisor',
    keyFact: { value: '2–3 yrs', caption: "how recent a professor's last grant should be" },
    intro: [
      'For research degrees, the professor matters more than the school. Look for recent papers and a recent grant: funded professors are the ones hiring.',
    ],
    body: [
      {
        type: 'expertPromo',
        promo: {
          label: WISDOMLINKED,
          heading: 'Talk to someone in your field',
          text: 'Our experts are faculty and researchers at U.S. universities. Ask which labs fit your background before you email anyone.',
          cta: 'Find an expert',
        },
      },
      {
        type: 'links',
        items: [
          {
            monogram: 'GS',
            name: 'Google Scholar',
            description: "A professor's recent publications",
            source: 'scholar.google.com',
            href: 'https://scholar.google.com',
          },
          {
            monogram: 'NSF',
            name: 'NSF Award Search',
            description: 'Active science and engineering grants',
            source: 'National Science Foundation',
            href: 'https://www.nsf.gov/awardsearch/',
          },
          {
            monogram: 'NIH',
            name: 'NIH RePORTER',
            description: 'Active biomedical and health research grants',
            source: 'National Institutes of Health',
            href: 'https://reporter.nih.gov',
          },
        ],
      },
    ],
  },
  {
    id: 'tests-and-credentials',
    number: 3,
    icon: 'pencil-line',
    timeRange: '12–6 months before',
    monthsFrom: -12,
    monthsTo: -6,
    title: 'Tests and credentials',
    keyFact: { value: '2 years', caption: 'how long TOEFL and IELTS scores stay valid' },
    intro: [
      "Requirements differ by program, and many have dropped the GRE. Check each program's admissions page before you book anything.",
    ],
    body: [
      {
        type: 'exams',
        items: [
          {
            category: 'English',
            name: 'TOEFL iBT',
            description: 'The most widely accepted English test at U.S. graduate schools.',
          },
          {
            category: 'English',
            name: 'IELTS Academic',
            description: 'Accepted by most U.S. graduate schools as an alternative to TOEFL.',
          },
          {
            category: 'English',
            name: 'Duolingo English Test',
            description: 'Taken online at home. Accepted by a growing number of programs.',
          },
          {
            category: 'Admissions',
            name: 'GRE General Test',
            description: 'Required by some programs, optional or ignored by others.',
          },
          { category: 'Admissions', name: 'GMAT', description: 'For business programs. Many also accept the GRE.' },
          {
            category: 'Transcripts',
            name: 'Credential evaluation',
            description: 'Only order one, from an agency such as WES, if a school requires it.',
          },
        ],
      },
    ],
  },
  {
    id: 'prepare-your-application',
    number: 4,
    icon: 'file-text',
    timeRange: 'September – January',
    monthsFrom: -12,
    monthsTo: -8,
    title: 'Prepare your application',
    keyFact: { value: 'Dec 1 – Jan 15', caption: 'when most Ph.D. deadlines fall' },
    intro: [
      'Ask recommenders at least six weeks ahead, and send them your CV, statement draft and deadlines in one email.',
    ],
    body: [
      {
        type: 'guides',
        items: [
          {
            title: 'Statement of Purpose',
            description: 'How to structure it, what committees look for, and the mistakes they see most often.',
          },
          {
            title: 'Writing to professors',
            description: 'When an email helps, what to include, and when not to write at all.',
          },
        ],
        footnote: 'CVs, recommendation letters, school lists and timelines',
      },
    ],
  },
  {
    id: 'funding-and-offers',
    number: 5,
    icon: 'wallet',
    timeRange: 'January – April 15',
    monthsFrom: -8,
    monthsTo: -4.5,
    title: 'Funding and offers',
    keyFact: { value: 'April 15', caption: 'the usual deadline to accept a funded offer' },
    intro: [
      "For international Ph.D. students, funding usually comes from the department as a research or teaching assistantship. At most U.S. universities you don't have to accept a funded offer before ",
      {
        text: 'April 15',
        href: 'https://cgsnet.org/resources/for-current-prospective-graduate-students/april-15-resolution',
      },
      ', so take the time to compare.',
    ],
  },
  {
    id: 'student-visa',
    number: 6,
    icon: 'id-card',
    timeRange: 'April – July',
    monthsFrom: -5,
    monthsTo: -1,
    title: 'Student visa',
    keyFact: { value: '30 days', caption: 'the earliest you can enter before your start date' },
    intro: ['The F-1 process happens in a fixed order. Each step needs the one before it.'],
    body: [
      {
        type: 'steps',
        items: [
          { title: 'Receive your I-20', description: 'Issued by your school after you accept and show funding.' },
          { title: 'Pay the SEVIS fee', description: 'Form I-901, online at fmjfee.com.' },
          { title: 'Complete the DS-160', description: 'The online visa application form.' },
          { title: 'Attend your interview', description: 'At a U.S. embassy or consulate.' },
          { title: 'Travel', description: 'No more than 30 days before your start date.' },
        ],
        note: [
          'Visa rules change often. Confirm each step on the ',
          {
            text: 'U.S. Department of State',
            href: 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html',
          },
          ' site.',
        ],
      },
      {
        type: 'expertPromo',
        promo: {
          label: WISDOMLINKED,
          heading: "Prepare with someone who's done it",
          text: 'Practice your interview and ask about your situation with an expert who went through the F-1 process.',
          cta: 'Book a session',
        },
      },
    ],
  },
  {
    id: 'arrive-and-settle-in',
    number: 7,
    icon: 'plane',
    timeRange: 'August',
    monthsFrom: -1,
    monthsTo: 0,
    title: 'Arrive and settle in',
    keyFact: { value: 'Week 1', caption: 'check in with your international student office' },
    intro: [
      "Your school's international office must confirm your arrival in SEVIS, so visit them in your first days on campus. Download your I-94 arrival record and make sure it shows F-1. Then come the practical steps: a bank account, a phone plan, housing, and a Social Security number once you have an on-campus job.",
    ],
  },
];

export const richTextToPlain = (parts: RichText): string =>
  parts.map((p) => (typeof p === 'string' ? p : p.text)).join('');
