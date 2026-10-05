/** Inline text with optional external links, so copy stays editable without JSX. */
export type RichText = (string | { text: string; href: string })[];

export type StageIcon = 'list-checks' | 'user-search' | 'pencil-line' | 'file-text' | 'wallet' | 'id-card' | 'plane';

export type ResourceLink = { monogram: string; name: string; description: string; source: string; href: string };
export type Exam = { category: string; name: string; description: string };
export type GuidePreview = { title: string; description: string };
export type Step = { title: string; description: string };
export type ExpertPromoContent = { label: string; heading: string; text: string; cta: string; disclaimer?: string };

export type StageBody =
  | { type: 'links'; items: ResourceLink[]; note?: string }
  | { type: 'exams'; items: Exam[] }
  | { type: 'guides'; items: GuidePreview[]; footnote: string }
  | { type: 'steps'; items: Step[]; note?: RichText }
  | { type: 'expertPromo'; promo: ExpertPromoContent }
  | { type: 'checklist'; label: string; items: string[] };

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
  /** One entry per paragraph. */
  intro: RichText[];
  body?: StageBody[];
};

export const PLAN_MONTHS = 18;

export const RESOURCES_HEADER = {
  eyebrow: 'Resources',
  heading: 'Your path to graduate study in the U.S.',
  subtext:
    'What to do and when—from building your first shortlist to your first week on campus. Seven stages over about eighteen months, with authoritative resources to guide you at each step.',
  startCta: 'Start with stage 1',
  expertCta: 'Talk to an expert',
  timelineLabel: 'Your timeline',
};

export const PLAN_CHART = {
  ariaLabel: '18-month plan',
  title: 'Your 18-month plan',
  note: 'For a typical Fall start',
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
    keyFact: { value: '6–10', caption: 'a useful starting range for many applicants' },
    intro: [
      [
        "Look beyond the university's overall ranking. For graduate study—especially research degrees—faculty fit, departmental strength, research activity, funding, and program structure may matter more than the university's overall reputation.",
      ],
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
    keyFact: { value: 'Look for recent activity', caption: 'publications, projects, students & funding' },
    intro: [
      [
        "For research degrees, your prospective advisor and research fit can matter as much as—or more than—the university's reputation. Review the professor's recent publications, projects, lab members, and funding, and check whether they're accepting new students. A recent grant can signal openings for graduate research assistants.",
      ],
    ],
    body: [
      {
        type: 'expertPromo',
        promo: {
          label: WISDOMLINKED,
          heading: 'Talk to someone in your field',
          text: 'Connect with faculty, researchers, and experienced professionals who can help you understand which programs, research groups, or advisors may fit your background and goals.',
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
        note: 'Web accessibility may vary across regions or countries.',
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
      [
        "Requirements vary by program, and many programs no longer require the GRE. Check each program's official admissions requirements before registering for a test or ordering a credential evaluation.",
      ],
    ],
    body: [
      {
        type: 'exams',
        items: [
          {
            category: 'English',
            name: 'TOEFL iBT',
            description: 'Widely accepted by U.S. graduate programs.',
          },
          {
            category: 'English',
            name: 'IELTS Academic',
            description: 'Accepted by many U.S. graduate programs as proof of English proficiency.',
          },
          {
            category: 'English',
            name: 'Duolingo English Test',
            description:
              "Taken online at home. Accepted by a growing number of programs. Check each program's policy before registering.",
          },
          {
            category: 'Admissions',
            name: 'GRE General Test',
            description: 'Required by some programs, optional or not considered by others.',
          },
          { category: 'Admissions', name: 'GMAT', description: 'For business programs. Many also accept the GRE.' },
          {
            category: 'Transcripts',
            name: 'Credential evaluation',
            description: 'Order a credential evaluation, such as one from WES, only if your program requires it.',
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
    keyFact: { value: 'Dec. 1–Jan. 15', caption: 'a common deadline window for many U.S. Ph.D. programs' },
    intro: [
      [
        'Ask references at least six weeks in advance. Provide your CV, statement draft, program list, and submission deadlines in one organized message.',
      ],
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
        footnote: 'Get guidance tailored to your goals, background, and application stage.',
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
    keyFact: { value: 'April 15', caption: 'a common decision date for many funded graduate offers' },
    intro: [
      [
        'Funding for Ph.D. students may include research or teaching assistantships, fellowships, tuition support, and stipends. Compare the full funding package—not just the stipend—including tuition coverage, fees, health insurance, duration, and renewal conditions.',
      ],
      [
        {
          text: 'April 15',
          href: 'https://cgsnet.org/resources/for-current-prospective-graduate-students/april-15-resolution',
        },
        ' is a common decision date for many funded graduate offers at participating U.S. institutions. Always confirm the deadline and conditions stated in your individual offer.',
      ],
    ],
    body: [
      {
        type: 'checklist',
        label: 'Compare:',
        items: [
          'stipend',
          'tuition & fees',
          'health insurance',
          'guaranteed years',
          'summer funding',
          'teaching load',
          'cost of living',
        ],
      },
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
    keyFact: { value: '30 days', caption: 'earliest entry before your program start date' },
    intro: [['The F-1 visa process follows a sequence. Complete each required step before moving to the next.']],
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
          text: 'Practice for your visa interview and discuss practical questions with someone familiar with the F-1 student experience.',
          cta: 'Book a session',
          disclaimer: 'For official visa requirements, always rely on U.S. government sources.',
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
    keyFact: { value: 'Week 1', caption: 'Complete your international-student check-in' },
    intro: [
      [
        "Follow your school's international-student check-in instructions soon after arrival so your school can complete the required SEVIS registration. Review your I-94 arrival record and verify that your admission information is correct. Then take care of practical needs such as housing, banking, a mobile phone plan, transportation, and—if eligible—a Social Security number.",
      ],
    ],
  },
];

export const richTextToPlain = (parts: RichText): string =>
  parts.map((p) => (typeof p === 'string' ? p : p.text)).join('');

export const introToPlain = (paragraphs: RichText[]): string => paragraphs.map(richTextToPlain).join(' ');
