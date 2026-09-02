import { describe, expect, it } from 'vitest';
import { alertReducer } from './alertReducer';
import { actionTypes } from '../actions/types';
import { hideAlert, showErrorAlert, showSuccessAlert } from '../actions/alertActions';

describe('alertReducer', () => {
    it('opens with message and variant from showAlert payload', () => {
        const next = alertReducer(undefined, showErrorAlert('Something failed'));
        expect(next).toEqual({
            open: true,
            message: 'Something failed',
            variant: 'error',
        });
    });

    it('defaults variant to info when omitted', () => {
        const next = alertReducer(undefined, {
            type: actionTypes.showAlert,
            payload: { message: 'Heads up' },
        });
        expect(next.variant).toBe('info');
        expect(next.open).toBe(true);
    });

    it('hideAlert resets state', () => {
        const open = alertReducer(undefined, showSuccessAlert('Saved'));
        const closed = alertReducer(open, hideAlert());
        expect(closed).toEqual({
            open: false,
            message: '',
            variant: 'info',
        });
    });
});
