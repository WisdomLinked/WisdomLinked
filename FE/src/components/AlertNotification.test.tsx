import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AlertNotification from './AlertNotification';
import { alertReducer } from '../reducers/alertReducer';
import { enqueueToast, showErrorAlert, showSuccessAlert, showWarningAlert } from '../actions/alertActions';

function renderWithAlertState(preloadedAlert: ReturnType<typeof alertReducer>) {
    const store = configureStore({
        reducer: { alert: alertReducer },
        preloadedState: { alert: preloadedAlert },
        middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false }),
    });
    return render(
        <Provider store={store}>
            <AlertNotification />
        </Provider>,
    );
}

function createAlertStore() {
    return configureStore({
        reducer: { alert: alertReducer },
        middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false }),
    });
}

function stubMatchMedia(matchesReduce: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: matchesReduce && query.includes('prefers-reduced-motion: reduce'),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
}

describe('AlertNotification', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        stubMatchMedia(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders nothing when there are no toasts', () => {
        const { container } = renderWithAlertState({ toasts: [] });
        expect(container.querySelector('[role="status"], [role="alert"]')).toBeNull();
    });

    it('anchors the stack below the navbar at the top-right', () => {
        const store = createAlertStore();
        store.dispatch(showErrorAlert('Could not save'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        const toast = screen.getByRole('alert');
        expect(toast).toHaveTextContent('Could not save');
        expect(toast).toHaveAttribute('aria-live', 'assertive');
        expect(screen.getByLabelText('Close notification')).toBeInTheDocument();
        const stack = toast.closest('.wl-toast-stack');
        expect(stack).toHaveStyle({ top: 'calc(var(--header-height, 4.5rem) + 16px)' });
        expect(stack).toHaveClass('fixed');
    });

    it('uses status role for success toasts', () => {
        const store = createAlertStore();
        store.dispatch(showSuccessAlert('Saved'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Saved');
        expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('renders description and action label', () => {
        const store = createAlertStore();
        store.dispatch(
            enqueueToast({
                variant: 'info',
                title: 'Session updated',
                description: 'Your changes are live.',
                action: { label: 'View details', onClick: () => undefined },
            }),
        );
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Session updated');
        expect(screen.getByText('Your changes are live.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
    });

    it('dispatches hide on dismiss click after exit animation', () => {
        const store = createAlertStore();
        store.dispatch(showErrorAlert('Oops'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        fireEvent.click(screen.getByLabelText('Close notification'));
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(store.getState().alert.toasts).toHaveLength(0);
    });

    it('closes the focused toast on Escape', () => {
        const store = createAlertStore();
        store.dispatch(showWarningAlert('Check this'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        const toast = screen.getByRole('alert');
        toast.focus();
        fireEvent.keyDown(toast, { key: 'Escape' });
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(store.getState().alert.toasts).toHaveLength(0);
    });

    it('applies reduced-motion class when prefers-reduced-motion is set', () => {
        stubMatchMedia(true);
        const store = createAlertStore();
        store.dispatch(showSuccessAlert('Saved'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        expect(screen.getByRole('status')).toHaveClass('wl-toast-reduce');
    });

    it('pauses remaining time on mouse enter and resumes on leave', () => {
        const rafQueue: FrameRequestCallback[] = [];
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafQueue.push(cb);
            return rafQueue.length;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const store = createAlertStore();
        store.dispatch(enqueueToast({ variant: 'success', title: 'Saved', duration: 1000 }));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        const toast = screen.getByRole('status');
        fireEvent.mouseEnter(toast);

        now = 5000;
        act(() => {
            const queued = rafQueue.splice(0, rafQueue.length);
            queued.forEach(cb => cb(now));
        });
        expect(store.getState().alert.toasts).toHaveLength(1);

        fireEvent.mouseLeave(toast);
        now = 6500;
        act(() => {
            const queued = rafQueue.splice(0, rafQueue.length);
            queued.forEach(cb => cb(now));
        });
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(store.getState().alert.toasts).toHaveLength(0);
    });
});
