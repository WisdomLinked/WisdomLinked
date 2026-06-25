import axios from 'axios';
import { apiClient } from './apiClient';

let token: string | null = null;
let inflight: Promise<string | null> | null = null;
let generation = 0;
let abortController: AbortController | null = null;

const SAFE_METHODS = ['get', 'head', 'options'];

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

const fetchCsrfToken = (): Promise<string | null> => {
    const requestGeneration = generation;
    abortController = new AbortController();
    const signal = abortController.signal;

    return apiClient
        .get('auth/csrf-token', { signal })
        .then((res) => {
            if (requestGeneration !== generation) return null;
            const csrfToken = res?.data?.csrfToken;
            if (typeof csrfToken !== 'string' || !csrfToken) return null;
            token = csrfToken;
            return token;
        })
        .catch((err) => {
            if (isAbortError(err)) return null;
            return null;
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
        throw new Error('Could not fetch CSRF token');
    }
    return csrfToken;
};

export const getCsrfToken = () => token;

export const isCsrfError = (data: any, status?: number) =>
    status === 403 && (data?.code === 'EBADCSRFTOKEN' || /csrf/i.test(String(data?.error || '')));
