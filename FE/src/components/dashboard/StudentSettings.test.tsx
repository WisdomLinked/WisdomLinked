import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSettings from './StudentSettings';

vi.mock('../../api/api', () => ({
  doUpdateProfile: vi.fn(async () => true),
}));

import { doUpdateProfile } from '../../api/api';

const makeStore = (userDetails: Record<string, any>) =>
  configureStore({
    reducer: {
      auth: () => ({ userDetails }),
    },
  });

describe('StudentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists timeZone and notification preferences on save', async () => {
    render(
      <Provider store={makeStore({ timeZone: 'America/New_York' })}>
        <StudentSettings />
      </Provider>,
    );

    const select = screen.getByLabelText('Time zone') as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');

    fireEvent.change(select, { target: { value: 'Asia/Kolkata' } });
    // Turn marketing emails on (default off) to prove toggles are sent.
    fireEvent.click(
      screen.getByRole('button', { name: /Product & newsletter emails/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(doUpdateProfile).toHaveBeenCalledWith({
        timeZone: 'Asia/Kolkata',
        notificationPreferences: {
          email: true,
          push: true,
          seminarReminders: true,
          sessionReminders: true,
          marketing: true,
        },
      });
    });
  });

  it('hydrates toggles from saved preferences', () => {
    render(
      <Provider
        store={makeStore({
          timeZone: 'UTC',
          notificationPreferences: {
            email: false,
            push: true,
            seminarReminders: false,
            sessionReminders: true,
            marketing: true,
          },
        })}
      >
        <StudentSettings />
      </Provider>,
    );

    expect(
      screen.getByRole('button', { name: /Email notifications/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: /Product & newsletter emails/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
