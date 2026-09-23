export type ChatSection = 'none' | 'direct' | 'appointments' | 'communities' | 'seminars';

export const CHAT_SECTION_DEFAULT: ChatSection = 'none';

/** Dropdown entries, in the order they are listed under Chat. */
export const CHAT_SECTION_ITEMS: { id: ChatSection; label: string }[] = [
    { id: 'direct', label: 'DIRECT MESSAGES' },
    { id: 'appointments', label: '1:1 APPOINTMENTS' },
    { id: 'communities', label: 'COMMUNITIES' },
    { id: 'seminars', label: 'SEMINARS' },
];

const SECTIONS = new Set<ChatSection>(['none', 'direct', 'appointments', 'communities', 'seminars']);

export const normalizeChatSection = (value: unknown): ChatSection =>
    SECTIONS.has(value as ChatSection) ? (value as ChatSection) : CHAT_SECTION_DEFAULT;

export const isChatSectionUnset = (section: ChatSection): boolean => section === 'none';

export const showsCommunities = (section: ChatSection): boolean => section === 'communities';

export const showsAppointments = (section: ChatSection): boolean => section === 'appointments';

export const showsSeminars = (section: ChatSection): boolean => section === 'seminars';

export const chatSectionHeading = (section: ChatSection): string => {
    switch (section) {
        case 'direct':
            return 'Direct Messages';
        case 'appointments':
            return '1:1 Appointments';
        case 'seminars':
            return 'Seminars';
        case 'communities':
            return 'Communities';
        default:
            return 'Chat';
    }
};

export const chatSectionEmptyTitle = (section: ChatSection): string =>
    isChatSectionUnset(section)
        ? 'Select an option in the dropdown to open your chats'
        : 'Choose a chat from the list to get started.';

export const chatSectionEmptySubtitle = (section: ChatSection): string => {
    switch (section) {
        case 'communities':
            return 'Community rooms open in this panel.';
        case 'seminars':
            return 'Seminar chats open in this panel.';
        case 'appointments':
        case 'direct':
            return 'Direct messages open in this panel.';
        default:
            return '';
    }
};

export const sectionForChatTarget = (target: 'dm' | 'community' | 'seminar'): ChatSection => {
    switch (target) {
        case 'community':
            return 'communities';
        case 'seminar':
            return 'seminars';
        default:
            return 'appointments';
    }
};
