export const PUBLIC_ROUTES = [
    '/',
    '/aboutus',
    '/services',
    '/rules',
    '/contactus',
    '/resources',
    '/resources/graduate-school-guide',
    '/resources/scholarship-guide',
] as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

export type PublicPageRecord = {
    title: string;
    snippet: string;
    route: PublicRoute;
};

const joinText = (...parts: string[]) => parts.join(' ').replace(/\s+/g, ' ').trim();

const page = (route: PublicRoute, title: string, snippet: string): PublicPageRecord => ({
    title: joinText(title),
    snippet: joinText(snippet),
    route,
});

export const homePage = {
    route: '/' as const,
    hero: {
        titleLead: "Learn from the people who've already",
        titleAccent: 'made it.',
        snippet:
            'Talk directly with professors at world-class universities and industry experts. Get personalized guidance on grad admissions, research, scholarships, and career advancement.',
    },
    connect: {
        titleLead: 'Connect to Knowledge',
        titleAccent: 'Across the Globe',
        snippet:
            'Starting from Study and Work Abroad — WisdomLinked is a global consulting service company backed by professors in top universities in the U.S. and other countries.',
    },
    advice: {
        title: "Expert's advice",
        snippet:
            'Get personalized, one-on-one guidance from the elites of the elite or join a speacialized seminar',
    },
    guidelines: {
        title: 'Guidelines for Quality',
        snippet: 'Integrity, Respect, and Truth',
    },
    community: {
        title: 'Hear From Our Community',
        snippet: "Clients and experts who've transformed their journeys",
    },
    impact: {
        titleLead: 'Share Your Expertise,',
        titleAccent: 'Make an Impact',
        snippet:
            'Share your decades of experience with the next generation. Make a meaningful impact while building your global network and earning for your expertise.',
    },
    pricing: {
        title: 'Fair, transparent, expert driven rates',
        snippet:
            'Every expert sets their own rate based on their field, seniority, and demand. You see the full cost before you commit, no hidden fees, no surprises.',
    },
};

export const aboutPage = {
    route: '/aboutus' as const,
    titleLine1: 'Connected to Knowledge and Wisdom',
    titleLine2: 'Across the Globe, Starting From',
    titleLine3: 'Study and Work Abroad',
    snippet:
        'This is a global consulting service company backed by professors in top universities in the U.S. and other countries. The business draws on the talents of elite professionals, mostly top notch professors, scientists, researchers and other successful professionals. These elite professionals all have their graduate degrees, mostly Ph.D. with decades of successful experiences. They are generally considered leaders in their respective field: admitting and advising graduate students, conducting cutting edge research in frontier areas, or advancing practices in industries, etc.',
};

export const servicesPage = {
    route: '/services' as const,
    title: 'Uncommon Quality, Undeniable Value',
    intro: 'We provide advice regarding the following consulting-for-a-fee services through registered experts:',
    offerings: ['Study Abroad', 'Work Abroad', 'Research Guidance'],
};

export const rulesPage = {
    route: '/rules' as const,
    titleLine1: 'We have Rules for Both',
    titleLine2: 'Experts and Clients',
    intro: 'Both experts and clients shall recognize the following rules regarding the services.',
    items: [
        'The service is designed to be appointment based. Clients shall not expect to get instant, online services. An appointment is made after the client has paid at the asking price of an expert plus a tip. The payment is not refundable if the client does not show up at the appointment time; the payment is refundable if the expert fails to show up at the appointed time.',
        'The client may file a complaint if the service is not provided as arranged such as tardiness of experts, if the system fails to function normally, or if the service received is too poor. The management will look into the complaint and make effort to get back to the client within five business days.',
    ],
};

export const contactPage = {
    route: '/contactus' as const,
    title: 'Please contact us',
    snippet: 'Become a member 🤟🏻',
};

const homeStatsSnippet =
    '500+ Expert Consultants. 10K+ Consultations Done. 4.9/5 Average Rating. 100+ Countries Served. Trusted by 10,000+ clients worldwide.';

const homeConnectSnippet = joinText(
    'The business draws on the talents of elite professionals — mostly top-notch professors, scientists, researchers and other successful professionals. These elite professionals all have their graduate degrees, mostly Ph.D., with decades of successful experiences.',
    'A 30-minute conversation with an authoritative expert through this platform could save clients years or months of effort — or countless dollars that could otherwise be wasted in darkness.',
    'Who are our clients? People planning to go abroad for graduate studies, people looking for a job in the western world, and researchers seeking insightful advice with their research efforts.',
    "How do our experts join? Talents sign on a volunteer basis, providing available time slots for consulting at an asking price of their choice. It's flexible, impactful, and community-driven.",
    'How does booking work? Clients prepay for a time slot at the asking price plus a client-determined tip (zero or more) before an appointment is made.',
    'How do sessions run? At the time of an appointment, the expert and client converse via video or audio depending on agreed choices. Conversations may be recorded for quality control.',
    'Forms of communication. Customers may propose or accept a 1-1 appointment with an expert or join an expert-led seminar.',
    "User's Guide. The HelpBot after login can answer FAQs like 'How to initiate a 1-1 appointment with an expert'.",
    'Learn From Leaders Across Fields. Professors and industry experts from many disciplines, ready to guide you.',
    'Dr. Bruce Wang, Professor of Civil Engineering, UC Berkeley, academic.',
    'Dr. Mei Chen, Associate Professor of Computer Science, MIT, academic.',
    'Prof. James Okonkwo, Chair of Mechanical Engineering, Imperial College London, academic.',
    'Dr. Sarah Lindholm, Professor of Public Policy, KTH, academic.',
    'Priya Raman, Principal Strategy Consultant, AECOM, industry.',
    'Michael Torres, Director of Operations, WSP, industry.',
    'Elena Vasquez, Senior Structural Engineer, Arup, industry.',
    'David Kim, Head of Data Science, HDR, industry.',
);

const homeAdviceSnippet = joinText(
    'Study Abroad. Navigate applications, program fit, and admissions strategy with faculty who know top programs abroad. Program selection. Application materials. Scholarship planning.',
    'Work Abroad. Understand job markets, employer expectations, and relocation steps with professionals who have done it. Job search abroad. CV & interviews. Relocation basics.',
    'Research Guidance. Sharpen your research direction, methods, and publications with experienced researchers in your field. Research design. Writing & review. Lab and funding paths.',
);

const homeGuidelinesSnippet = joinText(
    "Basic rule. Users must comply with all applicable laws, provide truthful information, and agree to WisdomLinked's rules and agreements.",
    "Appointments & Payments. Our platform operates on an appointment-only basis and does not offer on-demand or real-time services. An appointment is confirmed once the client has submitted payment at the expert's listed rate, plus any applicable gratuity. If the client fails to attend the scheduled appointment, the payment is non-refundable. If the expert fails to attend, the client is entitled to a full refund.",
    'Complaints & Resolution. Clients may submit a complaint in the event of service-related issues, including but not limited to expert tardiness, platform technical difficulties, or unsatisfactory service quality. Our team will review each complaint and make every effort to respond within five (5) business days.',
);

const homeCommunitySnippet = joinText(
    'Sarah Chen, PhD Student, Stanford. The guidance I received helped me get into my dream program. My advisor reviewed my research proposal and gave invaluable feedback.',
    'Michael Rodriguez, Senior Engineer, Google. Talking with an expert in my field gave me the clarity I needed for my career transition. Worth every minute.',
    "Dr. Yuki Tanaka, Research Scientist. As an expert on the platform, I've connected with brilliant minds globally and found exceptional graduate students for my lab.",
    'Ahmed Hassan, MBA Graduate. The work abroad guidance clarified markets and interviews for me. I landed three offers within two months.',
);

const homeImpactSnippet = joinText(
    'Monetize your knowledge and expertise for societal impact.',
    'Direct recruitment pipeline for top graduate students.',
    'Expand your global network and perspectives.',
    'Flexible scheduling that fits your lifestyle.',
    'Conduct seminars and workshops to share your insights with a wider audience.',
);

const homePricingSnippet = joinText(
    'Pre-payment is fully refunded if your expert declines the request.',
    'Expert-set rates. Each consultant independently sets their hourly or per-session rate based on their expertise, institutional standing, and field. Browse by budget to find the right fit for you.',
    "Client gratuity. For high-demand experts, you may add a custom tip on top of the session rate. It's entirely optional, a way to show appreciation or secure a preferred slot.",
    'Request & confirm. Your booking is a proposal. The expert reviews your request and background before officially accepting, ensuring every session is a genuine match.',
    'Flexible rescheduling. Plans change. You can request a time shift at any point. The new slot becomes confirmed once your expert approves — no automatic cancellations.',
    'Two-way ratings. After every session, both expert and client leave a rating. This mutual accountability is how we maintain a community of excellence, and why our average sits at 4.9 out of 5.',
    'Full refund if the expert declines. Pre-payment is returned in full if the expert declines your request.',
);

const servicesPaymentSnippet =
    "We arrange one-to-one consulting conversation for a fee. Customers must register first through the website and provide necessary information for us to find matches of top experts. The registration is free of charge. Clients will decide whether to consult with an expert suggested by the services. This is mainly an appointment-based service. Once an available time slot is identified for both the expert and the client, an appointment will be made AFTER the client has paid online at the expert's asking price.";

const resourceGuides: {
    route: '/resources/graduate-school-guide' | '/resources/scholarship-guide';
    title: string;
    description: string;
    sections: { title: string; body: string }[];
}[] = [
    {
        route: '/resources/graduate-school-guide',
        title: 'Graduate School Guide',
        description:
            'Everything you need to know about applying to grad school — from choosing a program to letters of recommendation.',
        sections: [
            {
                title: 'Choosing a Program',
                body: `A strong application starts with a short, honest list of programs — not a spreadsheet of every ranking you can find. Fit beats prestige. Look for faculty whose current work matches the questions you want to study, not only a department's overall brand. Read two or three recent papers from potential advisors and note whether you could imagine contributing to that lab or group. Ask practical questions: Does the program fund students in year one, or only after a qualifying exam? Are there required rotations, a thesis, or a course-heavy first year? What do recent graduates do — academia, industry, national labs? Talk with current students if you can. They will tell you how advising actually works, how heavy teaching duties are, and whether the culture is collaborative or competitive. Aim for a balanced list: a few ambitious reaches, several realistic matches, and at least one program you would be glad to attend. If you are applying from outside the country you hope to study in, confirm language requirements, visa timelines, and whether the department has supported international students through funding gaps.`,
            },
            {
                title: 'Building a Strong SOP',
                body: `Your statement of purpose should read like a research conversation, not a childhood autobiography. Open with the problem you want to work on and why it matters. Then show the path that prepared you: a thesis, a paper, an internship, or a course sequence that changed how you think. Be specific — "I analyzed delay at a signalized intersection using two months of detector data" is stronger than "I am passionate about transportation." Keep the structure tight: What you want to study, in one or two sentences. Evidence that you can do that work (methods, results, tools). Why this department — name two or three faculty and how your interests overlap. What you hope to do after the degree, without over-promising. Cut clichés, avoid ranking the school, and do not recycle a generic essay with the university name swapped in. Have a mentor who knows the field read a draft. If English is not your first language, get a native-level edit for clarity, not for a fancier vocabulary. Most programs give you 500–1,000 words. Use them. A short, concrete SOP almost always beats a long, vague one.`,
            },
            {
                title: 'Requesting Letters of Recommendation',
                body: `Letters work when the writer can describe your work, not just your grade. Ask people who supervised research, a thesis, or a substantial project. A famous name who barely knows you is weaker than a lecturer who watched you debug a model for a semester. Ask at least six weeks before the first deadline, and give them an easy out: "If you do not feel you can write a strong letter, I completely understand." When they say yes, send a single packet: Your CV and unofficial transcript. A short paragraph on each program and why you are applying. Bullet points they might forget (your role on a paper, a presentation, a method you owned). A table of deadlines and how to submit. Remind them ten days before each due date. After it is submitted, send a thank-you and later tell them where you landed. Faculty remember students who close the loop, and you may need another letter next year.`,
            },
            {
                title: 'Timeline and Funding',
                body: `Treat applications as a six-month project, not a December scramble. A workable calendar: Spring / early summer: shortlist programs, email potential advisors with a focused note and CV, start GRE/TOEFL only if a program still requires them. Late summer: SOP outline, ask letter writers, order transcripts. Early fall: SOP drafts, faculty conversations, scholarship applications that share the same essay. November–January: submit; many STEM deadlines cluster here. February–April: interviews, visits, and funding offers. Funding is part of the offer, not a detail to check later. Compare stipend versus local rent, health insurance, summer support, and whether tuition is fully covered. If an offer is unfunded or only guaranteed for one year, ask the graduate coordinator what typical students actually receive. For a broader overview of graduate funding in the U.S., see Federal Student Aid (https://studentaid.gov/). International applicants should also map embassy appointment wait times onto this calendar so a late visa does not erase a funded offer.`,
            },
        ],
    },
    {
        route: '/resources/scholarship-guide',
        title: 'Scholarship Guide',
        description:
            'How to find awards that fit your profile, write a competitive application, and avoid the mistakes that get strong candidates skipped.',
        sections: [
            {
                title: 'Finding Scholarships',
                body: `The awards you are most likely to win are rarely the ones on a generic "top 50 scholarships" list. Start with restricted pools: your university, department, professional society, employer, home-country ministry, and community organizations. A $4,000 award with 40 applicants is often more realistic than a $40,000 award with 4,000. Search with constraints, not keywords alone: Citizenship, visa status, and where you will study. Field of study and career goal (research, teaching, public service). Need-based versus merit-based. Whether the award can be combined with a research assistantship. Use official portals and societies, not paid "we will find scholarships for you" services. Bookmark deadlines in one calendar. For U.S. federal aid and some grant searches, start at StudentAid.gov (https://studentaid.gov/). Ask your current department's coordinator which awards last year's students actually received — that list is worth more than a blog post. Revisit the search every term. New departmental awards appear quietly, and some fellowships open only once you are already enrolled.`,
            },
            {
                title: 'Writing a Winning Application',
                body: `Committees read quickly. They are looking for a clear story: who you are, what you will do with the money, and why their mission matches yours. Answer the prompt you were given. If they ask how you will serve your community after the degree, do not paste your research SOP. If they ask for a budget, make the numbers add up and explain each line. A clean application usually includes: A one-page narrative with a specific plan (coursework, research, internship) and a realistic timeline. Evidence: a paper, a project, a leadership role, or grades in the relevant sequence — not a list of every club. A budget that matches the award's allowed costs. Recommenders who can speak to the same story you told. Name the award in the first paragraph so the reader knows you did not send a mass email. Keep formatting simple: readable font, consistent headings, no dense blocks of text. Have someone outside your field read it; if they cannot explain your plan back to you, rewrite it.`,
            },
            {
                title: 'Common Mistakes to Avoid',
                body: `Most rejected applications are incomplete or off-mission, not "not smart enough." Watch for these: Missing a required transcript, signature, or eligibility checkbox. Writing a research SOP for a leadership or public-service award. Inflating titles ("led a lab" when you ran one experiment). Asking a recommender three days before the deadline. Ignoring word limits or uploading the wrong file. Applying to awards that exclude your visa type or degree level. Do not pay a consultant who guarantees a win. Do not copy essays from the internet — committees notice, and so do plagiarism checkers. If you are waitlisted, a short, factual update (a new paper, a new grade, a competing offer) is appropriate; a long emotional appeal is not. When you are unsure whether you are eligible, email the listed contact with one paragraph and your CV. Guessing and submitting anyway wastes their time and yours.`,
            },
            {
                title: 'After You Submit',
                body: `Submission is not the end of the process. Confirm that recommenders and portals show "received." Save PDFs of everything you uploaded. If the award interviews finalists, prepare a two-minute version of your plan and three questions about the program's expectations (reporting, internships, return-of-service). If you win: read the terms before you celebrate in public. Some awards cannot be combined with a full research assistantship; some require you to stay in a country or sector for a set period. Tell your department immediately so they can adjust your funding package. If you do not win: ask whether feedback is offered. Revise the essay while the committee's language is still in your head, and reuse a stronger draft on the next cycle. Many students win on the second or third try with the same core story and a tighter fit. Keep a simple tracker of awards, dates, and outcomes. Next year's you will thank you.`,
            },
        ],
    },
];

const resourcePages: PublicPageRecord[] = [
    page(
        '/resources',
        'Guides for students',
        'Practical advice on graduate school, scholarships, and building a stronger application.',
    ),
    ...resourceGuides.flatMap((guide) => [
        page('/resources', guide.title, guide.description),
        page(guide.route, guide.title, guide.description),
        ...guide.sections.map((section) => page(guide.route, section.title, section.body)),
    ]),
];

export const PUBLIC_PAGES: PublicPageRecord[] = [
    page('/', `${homePage.hero.titleLead} ${homePage.hero.titleAccent}`, `${homePage.hero.snippet} ${homeStatsSnippet}`),
    page(
        '/',
        `${homePage.connect.titleLead} ${homePage.connect.titleAccent}`,
        `${homePage.connect.snippet} ${homeConnectSnippet}`,
    ),
    page('/', homePage.advice.title, `${homePage.advice.snippet} ${homeAdviceSnippet}`),
    page('/', homePage.guidelines.title, `${homePage.guidelines.snippet} ${homeGuidelinesSnippet}`),
    page('/', homePage.community.title, `${homePage.community.snippet} ${homeCommunitySnippet}`),
    page('/', `${homePage.impact.titleLead} ${homePage.impact.titleAccent}`, `${homePage.impact.snippet} ${homeImpactSnippet}`),
    page('/', homePage.pricing.title, `${homePage.pricing.snippet} ${homePricingSnippet}`),
    page(
        '/aboutus',
        `${aboutPage.titleLine1} ${aboutPage.titleLine2} ${aboutPage.titleLine3}`,
        aboutPage.snippet,
    ),
    page(
        '/services',
        servicesPage.title,
        `${servicesPage.intro} ${servicesPage.offerings.join(' ')} ${servicesPaymentSnippet}`,
    ),
    page('/rules', `${rulesPage.titleLine1} ${rulesPage.titleLine2}`, `${rulesPage.intro} ${rulesPage.items.join(' ')}`),
    page('/contactus', contactPage.title, contactPage.snippet),
    ...resourcePages,
];

export function searchPublicPages(query: unknown): PublicPageRecord[] {
    const q = String(query ?? '').trim();
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    return PUBLIC_PAGES.filter((row) => {
        if (!PUBLIC_ROUTES.includes(row.route)) return false;
        return row.title.toLowerCase().includes(needle) || row.snippet.toLowerCase().includes(needle);
    }).map((row) => ({
        title: row.title,
        snippet: row.snippet,
        route: row.route,
    }));
}
