import { describe, expect, it } from 'vitest';
import { resolveUserFacingError } from './resolveUserFacingError';

describe('resolveUserFacingError', () => {
    it('reads axios-style response.data.error', () => {
        expect(
            resolveUserFacingError({
                response: { data: { error: 'Invalid credentials. Please try again.' } },
            }),
        ).toBe('Invalid credentials. Please try again.');
    });

    it('reads fetch-style parsedBody', () => {
        expect(
            resolveUserFacingError({
                status: 400,
                statusText: 'Bad Request',
                parsedBody: { error: 'Email is required.' },
            }),
        ).toBe('Email is required.');
    });

    it('returns payload-too-large message for 413', () => {
        expect(resolveUserFacingError({ status: 413, statusText: 'Payload Too Large' })).toContain(
            'too large',
        );
    });

    it('falls back for null', () => {
        expect(resolveUserFacingError(null)).toBe('Something went wrong. Please try again.');
    });
});
