const FALLBACK = 'Something went wrong. Please try again.';

const PAYLOAD_TOO_LARGE =
    'Payload is too large. Try a smaller file or message.';

function fromData(data: unknown): string | null {
    if (data == null) return null;
    if (typeof data === 'string') {
        const trimmed = data.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
        if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    }
    return null;
}

/**
 * Normalize axios, fetch Response, and plain Error shapes into a single user-safe string.
 */
export function resolveUserFacingError(error: unknown): string {
    if (error == null) return FALLBACK;

    const err = error as Record<string, unknown>;

    if (err.parsedBody != null) {
        const fromParsed = fromData(err.parsedBody);
        if (fromParsed) return fromParsed;
    }

    const axiosData = (err.response as { data?: unknown } | undefined)?.data;
    const fromAxios = fromData(axiosData);
    if (fromAxios) return fromAxios;

    const status = err.status as number | undefined;
    const statusText = typeof err.statusText === 'string' ? err.statusText : '';

    if (status === 413) return PAYLOAD_TOO_LARGE;

    if (status && statusText) {
        return `${statusText} (${status})`;
    }

    if (typeof err.message === 'string') {
        const msg = err.message.trim();
        if (msg && !msg.startsWith('[object ') && msg !== 'Network Error') {
            return msg;
        }
        if (msg === 'Network Error') {
            return 'Network error. Check your connection and try again.';
        }
    }

    return FALLBACK;
}
