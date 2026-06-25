import axios from 'axios';

let BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
if (BASE_URL && !BASE_URL.endsWith('/')) {
    BASE_URL += '/';
}

/** Shared axios instance for API + CSRF bootstrap (credentials, base URL). */
export const apiClient = axios.create({
    withCredentials: true,
    baseURL: BASE_URL,
});

export { BASE_URL };
