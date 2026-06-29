import test from 'node:test';
import assert from 'node:assert/strict';
import { isRcAuthError } from '../utils/rcSessionErrors';

test('isRcAuthError detects RC 401 session expiry', () => {
    assert.equal(
        isRcAuthError({
            response: {
                status: 401,
                data: { error: 'You must be logged in to do this.', message: 'You must be logged in to do this.' },
            },
        }),
        true,
    );
});

test('isRcAuthError ignores user-not-found (400)', () => {
    assert.equal(
        isRcAuthError({
            response: { status: 400, data: { error: 'User not found.' } },
        }),
        false,
    );
});

test('isRcAuthError ignores username-already-in-use (400)', () => {
    assert.equal(
        isRcAuthError({
            response: {
                status: 400,
                data: { error: 'khussal_tamu.edu is already in use :( [error-field-unavailable]' },
            },
        }),
        false,
    );
});
