export type FooterInfoId =
    | 'help'
    | 'notifications'
    | 'privacy'
    | 'terms'
    | 'cookies'
    | 'about'
    | 'opportunities'
    | 'address';

export type FooterDialogAction = 'contact';

export interface FooterInfoContent {
    title: string;
    paragraphs: string[];
    /** Renders the paragraphs as a postal address. */
    address?: boolean;
    secondaryAction?: { label: string; action: FooterDialogAction };
}

export const FOOTER_INFO: Record<FooterInfoId, FooterInfoContent> = {
    help: {
        title: 'Help',
        paragraphs: [
            'Get help when you need it. Contact our support team, or use Search and the HelpBot after signing in for instant guidance on using WisdomLinked and finding the right match.',
        ],
    },
    notifications: {
        title: 'Notifications',
        paragraphs: [
            'Stay informed about important account and appointment activity. We send email notifications for registration updates, payment confirmations, appointment requests and confirmations, schedule changes, and other important account activity.',
            "New users: If you don't see an expected email, please check your spam or junk folder.",
        ],
    },
    privacy: {
        title: 'Privacy',
        paragraphs: [
            'We take your privacy seriously. Personal information, account information, and private communications are handled in accordance with our Privacy Policy and are protected using appropriate security and access controls.',
            'Consultation materials are accessible only to authorized participants and personnel as needed to provide, support, secure, or comply with legal requirements for the service.',
        ],
    },
    terms: {
        title: 'Terms of Service',
        paragraphs: [
            'By creating an account and using WisdomLinked, users agree to our Terms of Service and applicable platform policies.',
            'Users are responsible for complying with laws and regulations applicable to them and for using the platform appropriately and professionally. Experts are expected to honor accepted appointments and provide services professionally.',
        ],
    },
    cookies: {
        title: 'Cookie Preferences',
        paragraphs: [
            'WisdomLinked uses necessary cookies to operate and secure the platform. With your permission, we may also use optional cookies to understand how the site is used and improve your experience. You can review or change your preferences at any time.',
        ],
    },
    about: {
        title: 'About WisdomLinked',
        paragraphs: [
            'WisdomLinked is an open, user-driven community where people are free to connect, participate, and move on as their needs evolve.',
            'Through transparent profiles, credible two-way ratings, and a secure platform, quality professional services can earn the recognition they deserve. We believe lasting progress is built on honesty, integrity, and trust.',
        ],
    },
    opportunities: {
        title: 'Opportunities',
        paragraphs: [
            'We are always looking for experts interested in leading and developing a specialty area within a region or country, and professionals who can help strengthen WisdomLinked, expand its capabilities, and grow its reach.',
            'Interested? Contact us and tell us how you would like to contribute.',
        ],
        secondaryAction: { label: 'Contact us', action: 'contact' },
    },
    address: {
        title: 'Address',
        // Placeholder address: replace with the official business address.
        paragraphs: ['1512 HW90, Anderson, TX'],
        address: true,
    },
};

export type FooterLink =
    | { kind: 'info'; label: string; contentId: FooterInfoId }
    | { kind: 'comingSoon'; label: string }
    | { kind: 'route'; label: string; to: string }
    | { kind: 'external'; label: string; href: string };

export interface FooterColumn {
    heading: string;
    note?: string;
    links: FooterLink[];
}

/** Flip to true once the official social accounts are live. */
const SOCIAL_LINKS_ENABLED = false;

// Placeholder handles: confirm the official account URLs before enabling.
const SOCIAL_ACCOUNTS: { label: string; href: string }[] = [
    { label: 'X', href: 'https://x.com/wisdomlinked' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/wisdomlinked' },
    { label: 'Facebook', href: 'https://www.facebook.com/wisdomlinked' },
    { label: 'Instagram', href: 'https://www.instagram.com/wisdomlinked' },
    { label: 'YouTube', href: 'https://www.youtube.com/@wisdomlinked' },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
    {
        heading: 'Resources',
        links: [
            { kind: 'info', label: 'Help', contentId: 'help' },
            { kind: 'info', label: 'Notifications', contentId: 'notifications' },
            { kind: 'info', label: 'Privacy', contentId: 'privacy' },
            { kind: 'info', label: 'Terms of Service', contentId: 'terms' },
            { kind: 'info', label: 'Cookie Preferences', contentId: 'cookies' },
        ],
    },
    {
        heading: 'Company',
        links: [
            { kind: 'info', label: 'About WisdomLinked', contentId: 'about' },
            { kind: 'info', label: 'Opportunities', contentId: 'opportunities' },
            { kind: 'info', label: 'Address', contentId: 'address' },
            { kind: 'comingSoon', label: 'Press' },
            { kind: 'comingSoon', label: 'Blog' },
        ],
    },
    {
        heading: 'Follow WisdomLinked',
        note: SOCIAL_LINKS_ENABLED ? undefined : '(To be available soon)',
        links: SOCIAL_ACCOUNTS.map(({ label, href }) =>
            SOCIAL_LINKS_ENABLED ? { kind: 'external', label, href } : { kind: 'comingSoon', label },
        ),
    },
];

export const FOOTER_LEGAL_LINKS: FooterLink[] = [
    { kind: 'info', label: 'Privacy', contentId: 'privacy' },
    { kind: 'info', label: 'Terms', contentId: 'terms' },
    { kind: 'info', label: 'Cookie Preferences', contentId: 'cookies' },
];
