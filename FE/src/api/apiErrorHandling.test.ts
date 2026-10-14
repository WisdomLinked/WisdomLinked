import { describe, expect, it, vi, beforeEach } from 'vitest';

const dispatch = vi.fn();
const getState = vi.fn(() => ({ auth: { userDetails: null } }));
const logoutUser = vi.fn(() => ({ type: 'LOGOUT' }));
const SetLoadingStatus = vi.fn();

vi.mock('../store', () => ({ store: { dispatch, getState } }));
vi.mock('../actions/authActions', () => ({ logoutUser }));
vi.mock('../actions/appActions', () => ({ SetLoadingStatus }));
vi.mock('../utils/notify', () => ({
    notify: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
    },
}));

import { notify } from '../utils/notify';

describe('apiErrorHandling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getState.mockReturnValue({ auth: { userDetails: null } });
        localStorage.clear();
    });

    it('handleApiFailure dispatches toast when notify is true', async () => {
        const { handleApiFailure } = await import('./apiErrorHandling');
        const result = handleApiFailure({
            response: { status: 500, data: { error: 'Server error' } },
        });
        expect(result).toBe(false);
        expect(notify.error).toHaveBeenCalledWith('Server error');
    });

    it('handleAuthApiFailure returns FAIL body without toast', async () => {
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: { status: 500, data: { error: 'Invalid credentials. Please try again.' } },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: 'Invalid credentials. Please try again.',
        });
        expect(notify.error).not.toHaveBeenCalled();
    });

    it('handleAuthApiFailure logs out on 401 when session exists', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({ response: { status: 401 } });
        expect(result).toBe(false);
        expect(logoutUser).toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on 401 without stored session', async () => {
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({ response: { status: 401 } });
        expect(result).toEqual({
            status: 'FAIL',
            error: expect.any(String),
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on CSRF 403', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: {
                status: 403,
                data: { code: 'EBADCSRFTOKEN', error: 'Invalid or missing CSRF token.' },
            },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: expect.stringContaining('CSRF'),
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });

    it('handleApiFailure does not logout when stored user is under review (generic 401 body)', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'review' }));
        const { handleApiFailure } = await import('./apiErrorHandling');
        const result = handleApiFailure({
            response: { status: 401, data: 'Something went wrong. Please try again.' },
        });
        expect(result).toBe(false);
        expect(logoutUser).not.toHaveBeenCalled();
        expect(notify.error).toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on UNDER_REVIEW code', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: {
                status: 401,
                data: {
                    status: 'FAIL',
                    error: 'Something went wrong. Please try again.',
                    code: 'UNDER_REVIEW',
                },
            },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: 'Something went wrong. Please try again.',
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });

    describe('blocked account (USER_BLOCKED)', () => {
        const blockedError = {
            response: {
                status: 401,
                data: {
                    status: 'FAIL',
                    error: 'Your profile is blocked. Contact admin for more details.',
                    code: 'USER_BLOCKED',
                },
            },
        };

        it('handleApiFailure keeps the session, shows no toast, and marks the user blocked', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'review' }));
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'review' } } } as any);
            const { handleApiFailure } = await import('./apiErrorHandling');

            expect(handleApiFailure(blockedError)).toBe(false);

            expect(logoutUser).not.toHaveBeenCalled();
            expect(notify.error).not.toHaveBeenCalled();
            expect(dispatch).toHaveBeenCalledWith({ type: 'updateUserDetails', payload: { status: 'blocked' } });
        });

        it('applies to an active user too, who would otherwise be logged out', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'active' } } } as any);
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure(blockedError);

            expect(logoutUser).not.toHaveBeenCalled();
            expect(dispatch).toHaveBeenCalledWith({ type: 'updateUserDetails', payload: { status: 'blocked' } });
        });

        it('does not re-dispatch once the user is already marked blocked', async () => {
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'blocked' } } } as any);
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure(blockedError);

            expect(dispatch).not.toHaveBeenCalled();
        });

        it('updates the stored user when the store is not hydrated yet, keeping its other fields', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'review', username: 'purna' }));
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure(blockedError);

            expect(dispatch).not.toHaveBeenCalled();
            expect(JSON.parse(localStorage.getItem('currentUser') || '{}')).toEqual({
                email: 'a@test.com',
                status: 'blocked',
                username: 'purna',
            });
        });

        it('handleAuthApiFailure returns the blocked message with its code', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'active' } } } as any);
            const { handleAuthApiFailure } = await import('./apiErrorHandling');

            expect(handleAuthApiFailure(blockedError)).toEqual({
                status: 'FAIL',
                error: 'Your profile is blocked. Contact admin for more details.',
                code: 'USER_BLOCKED',
            });
            expect(logoutUser).not.toHaveBeenCalled();
            expect(dispatch).toHaveBeenCalledWith({ type: 'updateUserDetails', payload: { status: 'blocked' } });
        });

        it('still logs out on a plain 401 for an active user', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure({ response: { status: 401, data: 'Something went wrong. Please try again.' } });

            expect(logoutUser).toHaveBeenCalled();
        });
    });

    describe('under-review refusal (UNDER_REVIEW) with quietAccountRestriction', () => {
        const reviewError = {
            response: {
                status: 401,
                data: { status: 'FAIL', error: 'Something went wrong. Please try again.', code: 'UNDER_REVIEW' },
            },
        };

        it('shows no toast, keeps the session, and marks the user under review', async () => {
            localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'active' } } } as any);
            const { handleApiFailure } = await import('./apiErrorHandling');

            expect(handleApiFailure(reviewError, { quietAccountRestriction: true })).toBe(false);

            expect(notify.error).not.toHaveBeenCalled();
            expect(logoutUser).not.toHaveBeenCalled();
            expect(dispatch).toHaveBeenCalledWith({ type: 'updateUserDetails', payload: { status: 'review' } });
        });

        it('still shows the toast for callers that did not opt in', async () => {
            getState.mockReturnValue({ auth: { userDetails: { email: 'a@test.com', status: 'review' } } } as any);
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure(reviewError);

            expect(notify.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
            expect(dispatch).not.toHaveBeenCalled();
        });

        it('leaves other failures to the normal toast even when opted in', async () => {
            const { handleApiFailure } = await import('./apiErrorHandling');

            handleApiFailure({ response: { status: 409, data: 'Selected time conflicts with an existing session' } }, { quietAccountRestriction: true });

            expect(notify.error).toHaveBeenCalledWith('Selected time conflicts with an existing session');
        });
    });
});

