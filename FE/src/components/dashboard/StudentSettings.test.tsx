import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSettings from './StudentSettings';

vi.mock('../../api/api', () => ({
  doUpdateProfile: vi.fn(async () => true),
  getMe: vi.fn(async () => ({ me: null })),
}));

import { doUpdateProfile, getMe } from '../../api/api';

const updateProfile = vi.mocked(doUpdateProfile);
const fetchMe = vi.mocked(getMe);

const makeStore = (userDetails: Record<string, any>) =>
  configureStore({
    reducer: {
      auth: (state: any = { userDetails }, action: any) =>
        action.type === 'updateUserDetails'
          ? { ...state, userDetails: { ...state.userDetails, ...action.payload } }
          : state,
    },
  });

const renderSettings = (userDetails: Record<string, any> = { timeZone: 'America/New_York' }) => {
  const store = makeStore(userDetails);
  const view = render(
    <Provider store={store}>
      <StudentSettings />
    </Provider>,
  );
  return { store, ...view };
};

const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>(r => { resolve = r; });
  return { promise, resolve };
};

const toggle = (name: string | RegExp) => screen.getByRole('switch', { name });

describe('StudentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfile.mockResolvedValue(true);
    fetchMe.mockResolvedValue({ me: null } as any);
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

  it('auto-saves only the switch that changed, with the backend field name, and confirms it', async () => {
    renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');

    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({ notificationPreferences: { seminarReminders: false } });
  });

  it('each switch saves under its own backend name', async () => {
    const fields: Array<[string, string]> = [
      ['Bookings and approvals', 'bookings'],
      ['Seminar reminders', 'seminarReminders'],
      ['1:1 session reminders', 'sessionReminders'],
      ['Email notifications', 'email'],
    ];
    for (const [label, field] of fields) {
      vi.clearAllMocks();
      updateProfile.mockResolvedValue(true);
      const { unmount } = renderSettings();
      fireEvent.click(toggle(label));
      await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
      expect(updateProfile).toHaveBeenCalledWith({ notificationPreferences: { [field]: false } });
      unmount();
    }
  });

  it('debounces quick changes into one save of only the net change', async () => {
    renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    fireEvent.click(toggle('1:1 session reminders'));
    fireEvent.click(toggle('Seminar reminders'));

    await screen.findByText('Settings saved');
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({ notificationPreferences: { sessionReminders: false } });
  });

  it('switching on and straight back off sends nothing', async () => {
    renderSettings();

    fireEvent.click(toggle('Bookings and approvals'));
    fireEvent.click(toggle('Bookings and approvals'));

    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'true');
  });

  it('a later change sends only what changed since the last save', async () => {
    renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    await screen.findByText('Settings saved');

    fireEvent.click(toggle('Bookings and approvals'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
    expect(updateProfile.mock.calls[1][0]).toEqual({ notificationPreferences: { bookings: false } });
  });

  it('a page showing old values never rewrites a switch it did not touch', async () => {
    // This tab still believes Bookings is on; another tab has since switched it off.
    renderSettings({ timeZone: 'UTC', notificationPreferences: { bookings: true } });

    fireEvent.click(toggle('Seminar reminders'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const sent = updateProfile.mock.calls[0][0];
    expect(sent).toEqual({ notificationPreferences: { seminarReminders: false } });
    expect('bookings' in sent.notificationPreferences).toBe(false);
    expect('timeZone' in sent).toBe(false);
  });

  it('after a failed save, the next save still carries the earlier change', async () => {
    updateProfile.mockResolvedValueOnce(false as any);
    renderSettings();

    fireEvent.click(toggle('Bookings and approvals'));
    await screen.findByText("Couldn't save your settings. Try again.");
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle('Bookings and approvals'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
    expect(updateProfile.mock.calls[1][0]).toEqual({ notificationPreferences: { bookings: false } });
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('shows new values from the server when nothing of its own is waiting to save', async () => {
    const { store } = renderSettings({ timeZone: 'UTC', notificationPreferences: { bookings: true } });

    act(() => {
      store.dispatch({ type: 'updateUserDetails', payload: { notificationPreferences: { bookings: false } } });
    });

    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'false');
  });

  it('server values arriving mid-edit do not undo the edit, and are shown once it is saved', async () => {
    const pending = deferred();
    updateProfile.mockImplementationOnce(() => pending.promise);
    const { store } = renderSettings({ timeZone: 'UTC', notificationPreferences: { bookings: true } });

    fireEvent.click(toggle('Seminar reminders'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));

    // Another tab's Bookings change arrives while this save is in flight.
    act(() => {
      store.dispatch({ type: 'updateUserDetails', payload: { notificationPreferences: { bookings: false, seminarReminders: false } } });
    });
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');

    await act(async () => { pending.resolve(true); });
    await screen.findByText('Settings saved');
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'false');
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');
  });

  it('a refresh landing before a click is saved neither undoes nor drops that click', async () => {
    const { store } = renderSettings({ timeZone: 'UTC', notificationPreferences: { bookings: true, seminarReminders: true } });

    fireEvent.click(toggle('Seminar reminders'));
    // Arrives inside the save delay, still carrying the old Seminar value.
    act(() => {
      store.dispatch({ type: 'updateUserDetails', payload: { notificationPreferences: { bookings: false, seminarReminders: true } } });
    });
    expect(toggle('Seminar reminders')).toHaveAttribute('aria-checked', 'false');

    await screen.findByText('Settings saved');
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith({ notificationPreferences: { seminarReminders: false } });
  });

  it('re-reads the switches when the tab comes back into focus', async () => {
    fetchMe.mockResolvedValue({ me: { timeZone: 'UTC', notificationPreferences: { email: true, bookings: false } } } as any);
    renderSettings({ timeZone: 'UTC', notificationPreferences: { email: true, bookings: true } });
    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'true');

    await act(async () => { window.dispatchEvent(new Event('focus')); });

    await waitFor(() => expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'false'));
    expect(fetchMe).toHaveBeenCalledWith(undefined, { logoutOnAuth: false });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('a failed re-read on focus changes nothing', async () => {
    fetchMe.mockResolvedValue({ status: 'FAIL' } as any);
    renderSettings({ timeZone: 'UTC', notificationPreferences: { bookings: false } });

    await act(async () => { window.dispatchEvent(new Event('focus')); });

    expect(toggle('Bookings and approvals')).toHaveAttribute('aria-checked', 'false');
  });

  it('leaving the page right after a click still saves it', async () => {
    const { unmount } = renderSettings();

    fireEvent.click(toggle('Bookings and approvals'));
    unmount();

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith({ notificationPreferences: { bookings: false } });
  });

  it('leaving the page while a save is in flight still saves the change made after it', async () => {
    const pending = deferred();
    updateProfile.mockImplementationOnce(() => pending.promise);
    const { unmount } = renderSettings();

    fireEvent.click(toggle('Seminar reminders'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle('Bookings and approvals'));
    await new Promise(r => setTimeout(r, 450)); // the second click's save waits behind the first
    unmount();

    await act(async () => { pending.resolve(true); });
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(2));
    expect(updateProfile.mock.calls[1][0]).toEqual({ notificationPreferences: { bookings: false } });
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

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ timeZone: 'Asia/Kolkata' }));
  });
});
