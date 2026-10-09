import { describe, expect, it } from 'vitest';

import { findReviewRequest, reviewRequestOutcome, signInPathFor, EXPERT_RESPONSE_WINDOW_MS } from './requestReviewLink';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

const request = (over: Record<string, unknown> = {}) => ({
    _id: 'req-1',
    type: 'individual',
    status: 'pending',
    start: inHours(72),
    createdAt: inHours(-2),
    decisionDeadline: inHours(22),
    ...over,
});

describe('reviewRequestOutcome', () => {
    it('opens a request still inside its 24 hours', () => {
        expect(reviewRequestOutcome(request(), NOW)).toBe('open');
    });

    it('calls a pending request past its deadline expired, before the sweep has run', () => {
        expect(reviewRequestOutcome(request({ decisionDeadline: inHours(-0.1) }), NOW)).toBe('expired');
    });

    it('calls a pending request whose session has started expired', () => {
        expect(reviewRequestOutcome(request({ start: inHours(-1), decisionDeadline: null }), NOW)).toBe('expired');
    });

    it('calls a request the sweep cancelled after 24 hours expired', () => {
        expect(reviewRequestOutcome(request({ status: 'cancelled', createdAt: inHours(-25), decisionDeadline: null }), NOW)).toBe('expired');
    });

    it('does not call a request cancelled inside its 24 hours expired', () => {
        expect(reviewRequestOutcome(request({ status: 'cancelled', createdAt: inHours(-3) }), NOW)).toBe('unavailable');
        expect(reviewRequestOutcome(request({ status: 'cancelled', createdAt: undefined }), NOW)).toBe('unavailable');
    });

    it('recognises an accepted request, including a wallet booking awaiting payment', () => {
        expect(reviewRequestOutcome(request({ status: 'active' }), NOW)).toBe('accepted');
        expect(reviewRequestOutcome(request({ paymentMode: 'wallet', paymentDeadline: inHours(5), decisionDeadline: null }), NOW)).toBe('accepted');
    });

    it('treats a request that is not in the list as unavailable', () => {
        expect(reviewRequestOutcome(null, NOW)).toBe('unavailable');
    });

    it('uses a 24 hour window', () => {
        expect(EXPERT_RESPONSE_WINDOW_MS).toBe(24 * 3600_000);
    });
});

describe('findReviewRequest', () => {
    it('finds the 1:1 by id among populated or bare entries', () => {
        expect(findReviewRequest([request(), { _id: 'x', type: 'seminar' }], 'req-1')?._id).toBe('req-1');
        expect(findReviewRequest([{ _id: { toString: () => 'n' } }], 'missing')).toBeNull();
        expect(findReviewRequest(undefined, 'req-1')).toBeNull();
    });

    it('ignores a seminar that happens to share the id', () => {
        expect(findReviewRequest([{ _id: 'req-1', type: 'seminar' }], 'req-1')).toBeNull();
    });
});

describe('signInPathFor', () => {
    it('keeps a review link so the expert returns to the request after signing in', () => {
        expect(signInPathFor('/user/expertdashboard', '?review_request=req-1')).toBe(
            '/login?redirect=%2Fuser%2Fexpertdashboard%3Freview_request%3Dreq-1',
        );
    });

    it('signs every other page in exactly as before', () => {
        expect(signInPathFor('/user/expertdashboard', '')).toBe('/login');
        expect(signInPathFor('/user/studentdashboard', '?redirect_status=succeeded')).toBe('/login');
    });
});
