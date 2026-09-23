import { describe, expect, it } from 'vitest';
import { alertReducer } from './alertReducer';
import { hideAlert, showErrorAlert, showSuccessAlert, showWarningAlert, dismissToast, enqueueToast } from '../actions/alertActions';
import { MAX_VISIBLE_TOASTS } from '../types/alert';

describe('alertReducer', () => {
    it('enqueues a toast with message as title and variant', () => {
        const next = alertReducer(undefined, showErrorAlert('Something failed'));
        expect(next.toasts).toHaveLength(1);
        expect(next.toasts[0].title).toBe('Something failed');
        expect(next.toasts[0].variant).toBe('error');
        expect(next.toasts[0].durationMs).toBe(11000);
        expect(next.toasts[0].persistent).toBe(false);
    });

    it('defaults variant to info when omitted via enqueueToast', () => {
        const next = alertReducer(undefined, enqueueToast({ title: 'Heads up', variant: 'info' }));
        expect(next.toasts[0].variant).toBe('info');
        expect(next.toasts[0].durationMs).toBe(6500);
    });

    it('hideAlert clears all toasts', () => {
        const open = alertReducer(undefined, showSuccessAlert('Saved'));
        const closed = alertReducer(open, hideAlert());
        expect(closed).toEqual({ toasts: [] });
    });

    it('newest toasts sit first and cap at three', () => {
        let state = alertReducer(undefined, showSuccessAlert('One'));
        state = alertReducer(state, showSuccessAlert('Two'));
        state = alertReducer(state, showErrorAlert('Three'));
        state = alertReducer(state, showWarningAlert('Four'));
        expect(state.toasts).toHaveLength(MAX_VISIBLE_TOASTS);
        expect(state.toasts.map(t => t.title)).toEqual(['Four', 'Three', 'Two']);
    });

    it('dedupes identical toasts by bumping the existing one to the top', () => {
        let state = alertReducer(undefined, showErrorAlert('Same'));
        const firstId = state.toasts[0].id;
        state = alertReducer(state, showSuccessAlert('Other'));
        state = alertReducer(state, showErrorAlert('Same'));
        expect(state.toasts).toHaveLength(2);
        expect(state.toasts[0].id).toBe(firstId);
        expect(state.toasts[0].title).toBe('Same');
        expect(state.toasts[1].title).toBe('Other');
    });

    it('dismissToast removes one toast by id', () => {
        let state = alertReducer(undefined, showSuccessAlert('Keep'));
        state = alertReducer(state, showErrorAlert('Drop'));
        const dropId = state.toasts[0].id;
        state = alertReducer(state, dismissToast(dropId));
        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].title).toBe('Keep');
    });
});
