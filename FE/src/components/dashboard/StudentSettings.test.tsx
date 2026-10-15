import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSettings from './StudentSettings';

vi.mock('../../api/api', () => ({
  doUpdateProfile: vi.fn(async () => true),
}));

import { doUpdateProfile } from '../../api/api';

const updateProfile = vi.mocked(doUpdateProfile);

const makeStore = (userDetails: Record<string, any>) =>
  configureStore({
    reducer: {
      auth: () => ({ userDetails }),
    },
  });

const renderSettings = (userDetails: Record<string, any> = { timeZone: 'America/New_York' }) =>
  render(
    <Provider store={makeStore(userDetails)}>
      <StudentSettings />
    </Provider>,
  );

const toggle = (name: string | RegExp) => screen.getByRole('switch', { name });

describe('StudentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfile.mockResolvedValue(true);
  });

  it('shows only email notifications and time zone, with no save button', () => {
    renderSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Choose what you hear about and when.')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(5);
    expect(screen.queryByText(/Push notifications/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dark mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Security/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
  });

  it('hydrates switches and the summary from saved preferences', () => {
    renderSettings({
      timeZone: 'UTC',
      notificationPreferences: { email: true, seminarReminders: false, sessionReminders: true, marketing: true },
    });

    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');
    expect(toggle('1:1 session reminders')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('2 of 3 email types on')).toBeInTheDocument();
  });

  it('shows product updates as coming soon and disabled', () => {
    renderSettings({ timeZone: 'UTC', notificationPreferences: { marketing: true } });

    expect(toggle('Product updates')).toBeDisabled();
    expect(toggle('Product updates')).toHaveAttribute('aria-checked', 'false');
    expect(toggle('Product updates')).toHaveAccessibleDescription(/Coming soon/);
  });

  it('auto-saves a change with the backend field names and confirms it', async () => {
    renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');

    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({
      timeZone: 'America/New_York',
      notificationPreferences: {
        email: true,
        bookings: true,
        seminarReminders: false,
        sessionReminders: true,
        marketing: false,
      },
    });
  });

  it('debounces quick changes into one save of the final state', async () => {
    renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    fireEvent.click(toggle('1:1 session reminders'));
    fireEvent.click(toggle('Seminar reminders'));

    await screen.findByText('Settings saved');
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile.mock.calls[0][0].notificationPreferences).toMatchObject({
      seminarReminders: true,
      sessionReminders: false,
    });
  });

  it('reverts the change and shows an error when the save fails', async () => {
    updateProfile.mockResolvedValue(false as any);
    renderSettings();

    fireEvent.click(toggle('Bookings and approvals'));
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'false');

    expect(await screen.findByText("Couldn't save your settings. Try again.")).toBeInTheDocument();
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Settings saved')).not.toBeInTheDocument();
  });

  it('the master switch disables the options but keeps their values', async () => {
    renderSettings({ timeZone: 'UTC', notificationPreferences: { seminarReminders: false } });

    fireEvent.click(toggle('Email notifications'));
    expect(screen.getByText('All emails off')).toBeInTheDocument();
    expect(toggle('Bookings and approvals')).toBeDisabled();
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle('Email notifications'));
    expect(toggle('Bookings and approvals')).toBeEnabled();
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'true');
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');
  });

  it('expands and collapses the email options', () => {
    renderSettings();
    const header = screen.getByRole('button', { name: /Email notifications/i, expanded: true });
    const panel = document.getElementById(header.getAttribute('aria-controls')!)!;
    expect(panel).toBeVisible();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
  });

  it('saves a new time zone from the labelled select', async () => {
    renderSettings();
    const select = screen.getByLabelText('Time zone') as HTMLSelectElement;
    expect(select.value).toBe('America/New_York');

    fireEvent.change(select, { target: { value: 'Asia/Kolkata' } });

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ timeZone: 'Asia/Kolkata' })),
    );
  });
});
