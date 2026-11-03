import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/api', () => ({ login: vi.fn(), confirmLoginByCode: vi.fn() }));
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

import { confirmLoginByCode, login } from '../api/api';
import WLLogin from './WLLogin';

const mockedLogin = vi.mocked(login);
const mockedConfirm = vi.mocked(confirmLoginByCode);

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
    mockedLogin.mockResolvedValue({ status: 'FAIL', error: 'Your account is blocked. Contact support for help.' });
    await submit();
    expect(await screen.findByText('Your account is blocked. Contact support for help.')).toBeInTheDocument();
    expect(screen.queryByTestId('login-attempts-password')).toBeNull();
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
});
