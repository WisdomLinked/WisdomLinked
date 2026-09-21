import { describe, expect, it, vi, beforeEach } from 'vitest';
import { actionTypes } from '../actions/types';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock('../store', () => ({
    store: { dispatch, getState: vi.fn() },
}));

import { notify } from './notify';

describe('notify', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dispatches enqueue actions for each variant', () => {
        notify.success('Saved');
        notify.error('Failed', { description: 'Try again' });
        notify.warning('Careful');
        notify.info('Note');
        expect(dispatch).toHaveBeenCalledTimes(4);
        const payloads = dispatch.mock.calls.map(call => call[0]);
        expect(payloads.map(a => a.type)).toEqual([
            actionTypes.showAlert,
            actionTypes.showAlert,
            actionTypes.showAlert,
            actionTypes.showAlert,
        ]);
        expect(payloads[0].payload).toMatchObject({ variant: 'success', title: 'Saved' });
        expect(payloads[1].payload).toMatchObject({
            variant: 'error',
            title: 'Failed',
            description: 'Try again',
        });
        expect(payloads[2].payload.variant).toBe('warning');
        expect(payloads[3].payload.variant).toBe('info');
    });

    it('dismisses by id or all', () => {
        notify.dismiss('toast-1');
        notify.dismiss();
        expect(dispatch.mock.calls[0][0]).toEqual({
            type: actionTypes.hideAlert,
            payload: { id: 'toast-1' },
        });
        expect(dispatch.mock.calls[1][0]).toEqual({
            type: actionTypes.hideAlert,
            payload: undefined,
        });
    });
});
