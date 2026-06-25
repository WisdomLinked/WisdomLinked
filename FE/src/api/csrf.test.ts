import { describe, expect, it, vi, beforeEach } from 'vitest';

const axiosGet = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args: unknown[]) => axiosGet(...args),
    },
}));

describe('csrf', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        axiosGet.mockResolvedValue({ data: { csrfToken: 'token-a' } });
    });

    it('clearCsrfToken resets cached token and in-flight fetch', async () => {
        const csrf = await import('./csrf');
        let resolveFirst: (value: { data: { csrfToken: string } }) => void = () => {};
        axiosGet.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
        );

        const pending = csrf.ensureCsrfToken();
        csrf.clearCsrfToken();

        axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'token-b' } });
        resolveFirst({ data: { csrfToken: 'token-a' } });
        await pending;

        const refreshed = await csrf.ensureCsrfToken();
        expect(refreshed).toBe('token-b');
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('ensureCsrfToken with force fetches a new token even when cached', async () => {
        const csrf = await import('./csrf');
        await csrf.ensureCsrfToken();
        axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'token-b' } });

        const forced = await csrf.ensureCsrfToken({ force: true });

        expect(forced).toBe('token-b');
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('refreshCsrfToken always performs a forced fetch', async () => {
        const csrf = await import('./csrf');
        await csrf.ensureCsrfToken();
        axiosGet.mockResolvedValueOnce({ data: { csrfToken: 'token-c' } });

        const refreshed = await csrf.refreshCsrfToken();

        expect(refreshed).toBe('token-c');
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });
});
