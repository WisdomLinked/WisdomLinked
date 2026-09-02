import axios from 'axios';
import { apiClient } from './apiClient';

let token: string | null = null;
let inflight: Promise<string | null> | null = null;
let generation = 0;
let abortController: AbortController | null = null;

const SAFE_METHODS = ['get', 'head', 'options'];

const RATE_LIMIT_MESSAGE = 'Too many requests, please try again later.';

export class CsrfFetchError extends Error {
    readonly isRateLimit: boolean;

    constructor(message: string, isRateLimit = false) {
        super(message);
        this.name = 'CsrfFetchError';
        this.isRateLimit = isRateLimit;
    }
}

export const needsCsrf = (method?: string) =>
    !SAFE_METHODS.includes((method || 'get').toLowerCase());

export const clearCsrfToken = () => {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    generation += 1;
    token = null;
    inflight = null;
};

const isAbortError = (err: unknown) =>
    axios.isCancel(err) ||
    (err as { code?: string; name?: string })?.code === 'ERR_CANCELED' ||
    (err as { name?: string })?.name === 'AbortError';

const isRateLimitPayload = (status?: number, data?: unknown) => {
    if (status === 429) return true;
    if (data && typeof data === 'object') {
        const msg = String((data as { message?: string }).message || '');
        return /too many requests/i.test(msg);
    }
    return false;
};

const fetchCsrfToken = (): Promise<string | null> => {
    const requestGeneration = generation;
    abortController = new AbortController();
    const signal = abortController.signal;

    return apiClient
        .get('auth/csrf-token', { signal })
        .then((res) => {
            if (requestGeneration !== generation) return null;
            if (isRateLimitPayload(res.status, res.data)) {
                throw new CsrfFetchError(RATE_LIMIT_MESSAGE, true);
            }
            const csrfToken = res?.data?.csrfToken;
            if (typeof csrfToken !== 'string' || !csrfToken) {
                throw new CsrfFetchError('Could not fetch CSRF token');
            }
            token = csrfToken;
            return token;
        })
        .catch((err) => {
            if (err instanceof CsrfFetchError) throw err;
            if (isAbortError(err)) return null;
            const status = (err as { response?: { status?: number; data?: unknown } })?.response?.status;
            const data = (err as { response?: { data?: unknown } })?.response?.data;
            if (isRateLimitPayload(status, data)) {
                throw new CsrfFetchError(RATE_LIMIT_MESSAGE, true);
            }
            throw new CsrfFetchError('Could not fetch CSRF token');
        })
        .finally(() => {
            if (requestGeneration === generation) {
                inflight = null;
                abortController = null;
            }
        });
};

export const ensureCsrfToken = async (options?: { force?: boolean }): Promise<string | null> => {
    if (options?.force) {
        if (inflight) {
            await inflight.catch(() => null);
        }
        clearCsrfToken();
    } else if (token) {
        return token;
    }
    if (!inflight) {
        inflight = fetchCsrfToken();
    }
    return inflight;
};

export const refreshCsrfToken = () => ensureCsrfToken({ force: true });

/** Force-fetch CSRF for auth page bootstrap; rejects when token cannot be obtained. */
export const bootstrapCsrfToken = async (): Promise<string> => {
    const csrfToken = await refreshCsrfToken();
    if (!csrfToken) {
        throw new CsrfFetchError('Could not fetch CSRF token');
    }
    return csrfToken;
};

export const getCsrfToken = () => token;

export const isRateLimitError = (data: unknown, status?: number) => isRateLimitPayload(status, data);

export const isCsrfError = (data: any, status?: number) =>
    status === 403 && (data?.code === 'EBADCSRFTOKEN' || /csrf/i.test(String(data?.error || '')));
