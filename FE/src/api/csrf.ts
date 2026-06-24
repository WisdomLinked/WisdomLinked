import axios from "axios";

let base = process.env.REACT_APP_API_BASE_URL || '/api';
if (base && !base.endsWith('/')) base += '/';

let token: string | null = null;
let inflight: Promise<string | null> | null = null;

const SAFE_METHODS = ['get', 'head', 'options'];

export const needsCsrf = (method?: string) =>
    !SAFE_METHODS.includes((method || 'get').toLowerCase());

export const ensureCsrfToken = async (): Promise<string | null> => {
    if (token) return token;
    if (!inflight) {
        inflight = axios
            .get(`${base}auth/csrf-token`, { withCredentials: true })
            .then((res) => {
                token = res?.data?.csrfToken ?? null;
                return token;
            })
            .catch(() => null)
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
};

export const clearCsrfToken = () => {
    token = null;
};

export const isCsrfError = (data: any, status?: number) =>
    status === 403 && (data?.code === 'EBADCSRFTOKEN' || /csrf/i.test(String(data?.error || '')));
