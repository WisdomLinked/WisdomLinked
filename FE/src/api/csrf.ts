import axios from "axios";

let base = process.env.REACT_APP_API_BASE_URL || '/api';
if (base && !base.endsWith('/')) base += '/';

let token: string | null = null;
let inflight: Promise<string | null> | null = null;
let generation = 0;

const SAFE_METHODS = ['get', 'head', 'options'];

export const needsCsrf = (method?: string) =>
    !SAFE_METHODS.includes((method || 'get').toLowerCase());

export const clearCsrfToken = () => {
    generation += 1;
    token = null;
    inflight = null;
};

const fetchCsrfToken = (): Promise<string | null> => {
    const requestGeneration = generation;
    return axios
        .get(`${base}auth/csrf-token`, { withCredentials: true })
        .then((res) => {
            if (requestGeneration !== generation) return null;
            token = res?.data?.csrfToken ?? null;
            return token;
        })
        .catch(() => null)
        .finally(() => {
            if (requestGeneration === generation) {
                inflight = null;
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

export const isCsrfError = (data: any, status?: number) =>
    status === 403 && (data?.code === 'EBADCSRFTOKEN' || /csrf/i.test(String(data?.error || '')));
