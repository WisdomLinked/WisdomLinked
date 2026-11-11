import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/api', () => ({ login: vi.fn(), confirmLoginByCode: vi.fn(), getLoginLockStatus: vi.fn(), doContactUs: vi.fn() }));
vi.mock('../api/csrf', () => ({
  refreshCsrfToken: vi.fn(async () => 'token'),
  bootstrapCsrfToken: vi.fn(async () => 'token'),
  isCsrfError: () => false,
  CsrfFetchError: class extends Error {},
}));
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('../utils/resetAuthSession', () => ({ resetAuthSessionForLogin: vi.fn(async () => undefined) }));
vi.mock('../utils/notify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../components/SocialAuthBlock', () => ({ default: () => null }));
vi.mock('../components/SignupModal', () => ({ default: () => null }));
vi.mock('../components/BrandWordmark', () => ({ default: () => null }));

import { confirmLoginByCode, getLoginLockStatus, login } from '../api/api';
import { LOCK_STATUS_POLL_MS } from '../utils/loginAttemptNotice';
import WLLogin from './WLLogin';

const mockedLogin = vi.mocked(login);
const mockedConfirm = vi.mocked(confirmLoginByCode);
const mockedLockStatus = vi.mocked(getLoginLockStatus);

const BLOCKED_TEXT = 'Your profile is blocked. Contact admin for more details.';

const timesOnPage = (text: string) => (document.body.textContent ?? '').split(text).length - 1;

const signInButton = () => screen.getByRole('button', { name: 'Sign in' });

const submit = async (email = 'student@example.com', password = 'wrong') => {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Your password'), { target: { value: password } });
  await waitFor(() => expect(signInButton()).not.toBeDisabled());
  fireEvent.click(signInButton());
};

const typeCode = (code: string) => {
  const boxes = document.querySelectorAll<HTMLInputElement>('input.otp-box');
  code.split('').forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }));
};

const reachCodeStep = async () => {
  mockedLogin.mockResolvedValueOnce({ status: 'SUCCESS' } as any);
  await submit('student@example.com', 'Right#Pass1');
  await screen.findByText('Verify your identity');
};

describe('sign-in attempt limits', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    mockedConfirm.mockReset();
    mockedLockStatus.mockReset();
    render(<WLLogin />);
  });

  it('shows the tries left in red under the password, not in the banner', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Incorrect email or password. You have 4 attempts left.', attemptsLeft: 4 });
    await submit();
    const note = await screen.findByTestId('login-attempts-password');
    expect(note).toHaveTextContent('Incorrect email or password. You have 4 attempts left.');
    expect(note).toHaveClass('text-rose-600');
    expect(note.className).not.toMatch(/text-red-\d/);
    expect(screen.getAllByText(/You have 4 attempts left/)).toHaveLength(1);
  });

  it('locks the Sign in button with a live countdown, and releases it when time is up', async () => {
    mockedLogin.mockResolvedValue({
      status: 'FAIL',
      error: 'Too many failed sign-in attempts. Please try again in 1 minute.',
      attemptsLeft: 0,
      lockedStep: 'password',
      lockedForSeconds: 2,
    });
    await submit();
    expect(await screen.findByTestId('login-attempts-password')).toHaveTextContent(
      /^Too many failed sign-in attempts\. Please try again in 0:0[12]\.$/,
    );
    expect(signInButton()).toBeDisabled();
    await waitFor(() => expect(screen.queryByTestId('login-attempts-password')).toBeNull(), { timeout: 4000 });
    expect(signInButton()).not.toBeDisabled();
  });

  it('a lock on one email does not block typing a different email', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'locked', attemptsLeft: 0, lockedStep: 'password', lockedForSeconds: 600 });
    await submit();
    await screen.findByTestId('login-attempts-password');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'other@example.com' } });
    expect(screen.queryByTestId('login-attempts-password')).toBeNull();
    expect(signInButton()).not.toBeDisabled();
  });

  it('other failures still use the banner', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Please sign in with Google.' });
    await submit();
    expect(await screen.findByText('Please sign in with Google.')).toBeInTheDocument();
    expect(screen.queryByTestId('login-attempts-password')).toBeNull();
  });

  it('shows a blocked account in the same red line under the password, not in the banner', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await submit();
    const note = await screen.findByTestId('login-attempts-password');
    expect(note).toHaveTextContent(BLOCKED_TEXT);
    expect(note).toHaveClass('text-rose-600');
    expect(timesOnPage('Your profile is blocked.')).toBe(1);
    expect(signInButton()).not.toBeDisabled();
  });

  it('keeps the block reason hidden until "View reason" is clicked, and can hide it again', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED', blockReason: 'Repeated no-shows' });
    await submit();
    await screen.findByTestId('login-attempts-password');
    expect(screen.queryByText('Repeated no-shows')).toBeNull();
    const toggle = screen.getByTestId('block-reason-toggle');
    expect(toggle).toHaveTextContent('View reason');
    fireEvent.click(toggle);
    expect(screen.getByTestId('block-reason-text')).toHaveTextContent('Repeated no-shows');
    expect(toggle).toHaveTextContent('Hide reason');
    fireEvent.click(toggle);
    expect(screen.queryByText('Repeated no-shows')).toBeNull();
  });

  it('shows no "View reason" button when the blocked reply has no reason', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await submit();
    await screen.findByTestId('login-attempts-password');
    expect(screen.queryByTestId('block-reason-toggle')).toBeNull();
  });

  it('offers the block reason under the code boxes too', async () => {
    await reachCodeStep();
    mockedConfirm.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED', blockReason: 'Policy breach' });
    await act(async () => typeCode('123456'));
    await screen.findByTestId('login-attempts-otp');
    expect(screen.queryByText('Policy breach')).toBeNull();
    fireEvent.click(screen.getByTestId('block-reason-toggle'));
    expect(screen.getByTestId('block-reason-text')).toHaveTextContent('Policy breach');
  });

  it('clears the block reason when a different email is typed', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED', blockReason: 'Repeated no-shows' });
    await submit();
    await screen.findByTestId('login-attempts-password');
    fireEvent.click(screen.getByTestId('block-reason-toggle'));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'other@example.com' } });
    expect(screen.queryByTestId('block-reason-toggle')).toBeNull();
    expect(screen.queryByText('Repeated no-shows')).toBeNull();
  });

  it('makes "Contact admin for more details." a bold, underlined red link in the blocked message', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await submit();
    const note = await screen.findByTestId('login-attempts-password');
    const link = screen.getByTestId('contact-admin-link');
    expect(note).toContainElement(link);
    expect(link.tagName).toBe('BUTTON');
    expect(link).toHaveTextContent('Contact admin for more details.');
    expect(link).toHaveClass('font-bold', 'underline', 'text-rose-600');
    expect(link.className).not.toMatch(/text-red-\d/);
    expect(note).toHaveTextContent(BLOCKED_TEXT);
  });

  it('opens the Contact Us popup, with the typed email filled in, when the link is clicked, and closes it again', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await submit('blocked@example.com');
    expect(screen.queryByRole('heading', { name: 'Contact Us' })).toBeNull();
    fireEvent.click(await screen.findByTestId('contact-admin-link'));
    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
    const emails = screen.getAllByPlaceholderText('you@example.com') as HTMLInputElement[];
    expect(emails.map(e => e.value)).toEqual(['blocked@example.com', 'blocked@example.com']);
    const close = screen.getByRole('heading', { name: 'Contact Us' }).closest('.rounded-3xl')!.querySelector('button')!;
    fireEvent.click(close);
    expect(screen.queryByRole('heading', { name: 'Contact Us' })).toBeNull();
    expect(screen.getByTestId('contact-admin-link')).toBeInTheDocument();
  });

  it('makes the link clickable under the code boxes too', async () => {
    await reachCodeStep();
    mockedConfirm.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await act(async () => typeCode('123456'));
    await screen.findByTestId('login-attempts-otp');
    fireEvent.click(screen.getByTestId('contact-admin-link'));
    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
  });

  it('shows no contact link for a wrong password or a lock', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Incorrect email or password. Contact admin for more details.', attemptsLeft: 4 });
    await submit();
    await screen.findByTestId('login-attempts-password');
    expect(screen.queryByTestId('contact-admin-link')).toBeNull();
  });

  it('does not show the blocked text for a wrong password', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Incorrect email or password. You have 4 attempts left.', attemptsLeft: 4 });
    await submit();
    await screen.findByTestId('login-attempts-password');
    expect(screen.queryByText(BLOCKED_TEXT)).toBeNull();
  });

  it('clears the blocked text when a different email is typed', async () => {
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await submit();
    await screen.findByTestId('login-attempts-password');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'other@example.com' } });
    expect(screen.queryByText(BLOCKED_TEXT)).toBeNull();
  });

  it('shows the blocked text under the code boxes when the account is blocked after the password step', async () => {
    await reachCodeStep();
    mockedConfirm.mockResolvedValue({ status: 'FAIL', error: BLOCKED_TEXT, code: 'USER_BLOCKED' });
    await act(async () => typeCode('123456'));
    const note = await screen.findByTestId('login-attempts-otp');
    expect(note).toHaveTextContent(BLOCKED_TEXT);
    expect(note).toHaveClass('text-rose-600');
    expect(timesOnPage('Your profile is blocked.')).toBe(1);
  });

  it('shows the tries left in red under the code boxes', async () => {
    await reachCodeStep();
    mockedConfirm.mockResolvedValue({ status: 'FAIL', error: 'Incorrect verification code. You have 3 attempts left.', attemptsLeft: 3 });
    await act(async () => typeCode('000000'));
    const note = await screen.findByTestId('login-attempts-otp');
    expect(note).toHaveTextContent('Incorrect verification code. You have 3 attempts left.');
    expect(note).toHaveClass('text-rose-600');
  });

  it('a code lock disables the boxes and Resend while counting down', { timeout: 30000 }, async () => {
    await reachCodeStep();
    // Resend is held for its first 15 seconds anyway; wait that out so only the lock can disable it.
    await waitFor(() => expect(screen.getByRole('button', { name: /Resend code/ })).not.toBeDisabled(), { timeout: 20000 });
    mockedConfirm.mockResolvedValue({
      status: 'FAIL',
      error: 'Too many incorrect codes. Please try again in 15 minutes.',
      attemptsLeft: 0,
      lockedStep: 'otp',
      lockedForSeconds: 900,
    });
    await act(async () => typeCode('000000'));
    expect(await screen.findByTestId('login-attempts-otp')).toHaveTextContent(
      /^Too many incorrect codes\. Please try again in (15:00|14:59)\.$/,
    );
    document.querySelectorAll<HTMLInputElement>('input.otp-box').forEach(box => expect(box).toBeDisabled());
    expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();
  });

  it('an admin Unlock clears the countdown and re-enables Sign in without a refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockedLogin.mockResolvedValue({
        status: 'FAIL',
        error: 'Too many failed sign-in attempts. Please try again in 15 minutes.',
        attemptsLeft: 0,
        lockedStep: 'password',
        lockedForSeconds: 900,
      });
      mockedLockStatus.mockResolvedValue({ status: 'SUCCESS', locked: true, lockedStep: 'password', lockedForSeconds: 890 });
      await submit();
      await screen.findByTestId('login-attempts-password');
      expect(signInButton()).toBeDisabled();

      await act(async () => { await vi.advanceTimersByTimeAsync(LOCK_STATUS_POLL_MS); });
      expect(mockedLockStatus).toHaveBeenCalledWith('student@example.com');
      expect(screen.getByTestId('login-attempts-password')).toBeInTheDocument();
      expect(signInButton()).toBeDisabled();

      mockedLockStatus.mockResolvedValue({ status: 'SUCCESS', locked: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(LOCK_STATUS_POLL_MS); });
      expect(screen.queryByTestId('login-attempts-password')).toBeNull();
      expect(signInButton()).not.toBeDisabled();

      const calls = mockedLockStatus.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(LOCK_STATUS_POLL_MS * 2); });
      expect(mockedLockStatus.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not ask the server about locks when nothing is locked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Incorrect email or password. You have 4 attempts left.', attemptsLeft: 4 });
      await submit();
      await screen.findByTestId('login-attempts-password');
      await act(async () => { await vi.advanceTimersByTimeAsync(LOCK_STATUS_POLL_MS * 2); });
      expect(mockedLockStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('an Unlock on the code step re-enables the code boxes and Resend', { timeout: 30000 }, async () => {
    await reachCodeStep();
    await waitFor(() => expect(screen.getByRole('button', { name: /Resend code/ })).not.toBeDisabled(), { timeout: 20000 });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockedConfirm.mockResolvedValue({
        status: 'FAIL',
        error: 'Too many incorrect codes. Please try again in 15 minutes.',
        attemptsLeft: 0,
        lockedStep: 'otp',
        lockedForSeconds: 900,
      });
      await act(async () => typeCode('000000'));
      await screen.findByTestId('login-attempts-otp');
      expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();

      mockedLockStatus.mockResolvedValue({ status: 'SUCCESS', locked: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(LOCK_STATUS_POLL_MS); });
      expect(screen.queryByTestId('login-attempts-otp')).toBeNull();
      document.querySelectorAll<HTMLInputElement>('input.otp-box').forEach(box => expect(box).not.toBeDisabled());
      expect(screen.getByRole('button', { name: /Resend code/ })).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
