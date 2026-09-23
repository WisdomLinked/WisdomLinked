export const PUBLIC_ROUTES = ['/', '/aboutus', '/services', '/rules', '/contactus'] as const;

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

export const PUBLIC_PAGES: PublicPageRecord[] = [
    page('/', `${homePage.hero.titleLead} ${homePage.hero.titleAccent}`, homePage.hero.snippet),
    page('/', `${homePage.connect.titleLead} ${homePage.connect.titleAccent}`, homePage.connect.snippet),
    page('/', homePage.advice.title, homePage.advice.snippet),
    page('/', homePage.guidelines.title, homePage.guidelines.snippet),
    page('/', homePage.community.title, homePage.community.snippet),
    page('/', `${homePage.impact.titleLead} ${homePage.impact.titleAccent}`, homePage.impact.snippet),
    page('/', homePage.pricing.title, homePage.pricing.snippet),
    page(
        '/aboutus',
        `${aboutPage.titleLine1} ${aboutPage.titleLine2} ${aboutPage.titleLine3}`,
        aboutPage.snippet,
    ),
    page('/services', servicesPage.title, `${servicesPage.intro} ${servicesPage.offerings.join(' ')}`),
    page('/rules', `${rulesPage.titleLine1} ${rulesPage.titleLine2}`, `${rulesPage.intro} ${rulesPage.items.join(' ')}`),
    page('/contactus', contactPage.title, contactPage.snippet),
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
