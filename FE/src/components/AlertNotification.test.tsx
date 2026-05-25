import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AlertNotification from './AlertNotification';
import { alertReducer } from '../reducers/alertReducer';
import { showErrorAlert } from '../actions/alertActions';

function renderWithAlertState(preloadedAlert: ReturnType<typeof alertReducer>) {
    const store = configureStore({
        reducer: { alert: alertReducer },
        preloadedState: { alert: preloadedAlert },
    });
    return render(
        <Provider store={store}>
            <AlertNotification />
        </Provider>,
    );
}

describe('AlertNotification', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing when alert is closed', () => {
        const { container } = renderWithAlertState({
            open: false,
            message: '',
            variant: 'info',
        });
        expect(container.firstChild).toBeNull();
    });

    it('shows top-right toast with message and dismiss control', () => {
        renderWithAlertState({
            open: true,
            message: 'Could not save',
            variant: 'error',
        });
        expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
        expect(screen.getByLabelText('Close notification')).toBeInTheDocument();
    });

    it('dispatches hideAlert on dismiss click', () => {
        const store = configureStore({ reducer: { alert: alertReducer } });
        store.dispatch(showErrorAlert('Oops'));
        render(
            <Provider store={store}>
                <AlertNotification />
            </Provider>,
        );
        fireEvent.click(screen.getByLabelText('Close notification'));
        expect(store.getState().alert.open).toBe(false);
    });
});
