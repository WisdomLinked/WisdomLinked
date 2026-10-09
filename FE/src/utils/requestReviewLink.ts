import { pendingRequestIsLive, responseWindowLapsed } from './bookingLifecycle';

/** Query parameter the "Review the request" email button opens the expert dashboard with. */
export const REVIEW_REQUEST_PARAM = 'review_request';

/** How long an expert has to answer a 1:1 a student requested. */
export const EXPERT_RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const signInPathFor = (pathname: string, search: string): string => {
    if (!new URLSearchParams(search).get(REVIEW_REQUEST_PARAM)) return '/login';
    return `/login?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
};

export type ReviewRequestOutcome = 'open' | 'expired' | 'accepted' | 'unavailable';

const refId = (value: any): string =>
    String((value && typeof value === 'object' ? value._id : value) ?? '');

export const findReviewRequest = (groupChats: any[] | undefined, requestId: string): any | null =>
    (groupChats || []).find(g => refId(g) === String(requestId) && g?.type === 'individual') ?? null;

export const reviewRequestOutcome = (chat: any, now: number = Date.now()): ReviewRequestOutcome => {
    if (!chat) return 'unavailable';
    const status = String(chat.status ?? '').toLowerCase();
    if (status === 'active') return 'accepted';
    if (status === 'pending') {
        if (chat.paymentDeadline) return 'accepted';
        return !responseWindowLapsed(chat, now) && pendingRequestIsLive(chat, now) ? 'open' : 'expired';
    }
    if (status === 'cancelled') {
        const sentAt = new Date(chat.createdAt).getTime();
        return Number.isFinite(sentAt) && sentAt + EXPERT_RESPONSE_WINDOW_MS <= now ? 'expired' : 'unavailable';
    }
    return 'unavailable';
};

export const REVIEW_REQUEST_NOTICES: Record<Exclude<ReviewRequestOutcome, 'open'>, { title: string; body: string }> = {
    expired: {
        title: 'This request has expired',
        body: 'Session requests expire if they are not accepted or declined within 24 hours of being sent. It was cancelled automatically, and the student was not charged.',
    },
    accepted: {
        title: 'You have already accepted this request',
        body: 'You can find it under 1:1 Sessions on your dashboard.',
    },
    unavailable: {
        title: 'This request is no longer available',
        body: 'It may have been declined, or withdrawn by the student.',
    },
};
