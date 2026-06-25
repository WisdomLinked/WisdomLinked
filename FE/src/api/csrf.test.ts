import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGet = vi.fn();

vi.mock('./apiClient', () => ({
    apiClient: {
        get: (...args: unknown[]) => apiGet(...args),
    },
}));

describe('csrf', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        apiGet.mockResolvedValue({ status: 200, data: { csrfToken: 'token-a' } });
    });

    it('clearCsrfToken resets cached token and in-flight fetch', async () => {
        const csrf = await import('./csrf');
        let resolveFirst: (value: { status: number; data: { csrfToken: string } }) => void = () => {};
        apiGet.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
        );

        const pending = csrf.ensureCsrfToken();
        csrf.clearCsrfToken();

        apiGet.mockResolvedValueOnce({ status: 200, data: { csrfToken: 'token-b' } });
        resolveFirst({ status: 200, data: { csrfToken: 'token-a' } });
        await pending;

        const refreshed = await csrf.ensureCsrfToken();
        expect(refreshed).toBe('token-b');
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it('ensureCsrfToken with force fetches a new token even when cached', async () => {
        const csrf = await import('./csrf');
        await csrf.ensureCsrfToken();
        apiGet.mockResolvedValueOnce({ status: 200, data: { csrfToken: 'token-b' } });

        const forced = await csrf.ensureCsrfToken({ force: true });

        expect(forced).toBe('token-b');
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it('refreshCsrfToken always performs a forced fetch', async () => {
        const csrf = await import('./csrf');
        await csrf.ensureCsrfToken();
        apiGet.mockResolvedValueOnce({ status: 200, data: { csrfToken: 'token-c' } });

        const refreshed = await csrf.refreshCsrfToken();

        expect(refreshed).toBe('token-c');
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it('force refresh waits for in-flight fetch before starting a new one', async () => {
        const csrf = await import('./csrf');
        let resolveFirst: (value: { status: number; data: { csrfToken: string } }) => void = () => {};
        apiGet.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
        );

        const first = csrf.ensureCsrfToken();
        apiGet.mockResolvedValueOnce({ status: 200, data: { csrfToken: 'token-final' } });
        const forced = csrf.refreshCsrfToken();
        resolveFirst({ status: 200, data: { csrfToken: 'token-stale' } });

        await first;
        const result = await forced;

        expect(result).toBe('token-final');
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it('clearCsrfToken aborts in-flight fetch so stale response is not cached', async () => {
        const csrf = await import('./csrf');
        let rejectFirst: (reason?: unknown) => void = () => {};
        apiGet.mockImplementationOnce(
            (_url: string, config: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    config?.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                    rejectFirst = reject;
                }),
        );

        const pending = csrf.ensureCsrfToken();
        csrf.clearCsrfToken();
        apiGet.mockResolvedValueOnce({ status: 200, data: { csrfToken: 'token-fresh' } });

        await pending;
        expect(csrf.getCsrfToken()).toBeNull();

        const refreshed = await csrf.ensureCsrfToken();
        expect(refreshed).toBe('token-fresh');
        expect(csrf.getCsrfToken()).toBe('token-fresh');
    });

    it('returns null when response is missing csrfToken', async () => {
        const csrf = await import('./csrf');
        apiGet.mockResolvedValueOnce({ status: 200, data: { success: false } });

        const result = await csrf.ensureCsrfToken();

        expect(result).toBeNull();
        expect(csrf.getCsrfToken()).toBeNull();
    });

    it('bootstrapCsrfToken rejects when fetch fails', async () => {
        const csrf = await import('./csrf');
        apiGet.mockRejectedValueOnce(new Error('Network Error'));

        await expect(csrf.bootstrapCsrfToken()).rejects.toThrow('Could not fetch CSRF token');
    });

    it('bootstrapCsrfToken returns token on success', async () => {
        const csrf = await import('./csrf');

        await expect(csrf.bootstrapCsrfToken()).resolves.toBe('token-a');
    });
});
