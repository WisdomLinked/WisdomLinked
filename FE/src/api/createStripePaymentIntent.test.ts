import { describe, expect, it, vi, beforeEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('./apiClient', () => ({
    apiClient: {
        post,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
    BASE_URL: '',
}));
vi.mock('../store', () => ({
    store: { dispatch: vi.fn(), getState: () => ({ auth: { userDetails: null } }) },
}));
vi.mock('../actions/authActions', () => ({ logoutUser: vi.fn(() => ({ type: 'LOGOUT' })) }));
vi.mock('../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));

import { createStripePaymentIntent } from './api';

describe('createStripePaymentIntent', () => {
    beforeEach(() => {
        post.mockReset();
        localStorage.clear();
    });

    it('keeps the UNDER_REVIEW code when the server blocks an account under review', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 's@test.com', status: 'review' }));
        post.mockRejectedValue({
            response: {
                status: 401,
                data: { status: 'FAIL', error: 'Something went wrong. Please try again.', code: 'UNDER_REVIEW' },
            },
        });

        const result = await createStripePaymentIntent({});

        expect(result).toEqual({
            status: 'FAIL',
            error: 'Something went wrong. Please try again.',
            code: 'UNDER_REVIEW',
        });
    });

    it('returns the plain failure body for any other error', async () => {
        post.mockRejectedValue({ response: { status: 500, data: { error: 'Stripe is unavailable.' } } });

        const result = await createStripePaymentIntent({});

        expect(result).toEqual({ status: 'FAIL', error: 'Stripe is unavailable.' });
    });
});
