/** Safe user-facing messages for HTTP 500 responses (never expose raw err.message). */

export const HTTP_GENERIC_ERROR = 'Something went wrong. Please try again.';

export function safeErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        console.error(err.message);
    } else if (err != null) {
        console.error(err);
    }
    return HTTP_GENERIC_ERROR;
}
