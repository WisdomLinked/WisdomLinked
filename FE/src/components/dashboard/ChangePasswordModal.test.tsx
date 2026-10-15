import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChangePasswordModal from './ChangePasswordModal';
import DeleteAccountButton from './DeleteAccountButton';

vi.mock('../../api/api', () => ({
  passwordResetRequest: vi.fn(async () => ({ status: 'SUCCESS' })),
  confirmPasswordResetByCode: vi.fn(async () => ({ status: 'SUCCESS' })),
}));

import { confirmPasswordResetByCode, passwordResetRequest } from '../../api/api';

describe('ChangePasswordModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a code to the account email, then changes the password', async () => {
    render(<ChangePasswordModal email="expert@example.com" onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP to email' }));
    expect(passwordResetRequest).toHaveBeenCalledWith({ email: 'expert@example.com' });

    fireEvent.change(await screen.findByLabelText('One-time code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Secret#123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Secret#123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument();
    expect(confirmPasswordResetByCode).toHaveBeenCalledWith({
      email: 'expert@example.com',
      password: 'Secret#123',
      code: '123456',
    });
  });

  it('rejects mismatched passwords without calling the API', async () => {
    render(<ChangePasswordModal email="a@example.com" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP to email' }));

    fireEvent.change(await screen.findByLabelText('One-time code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Secret#123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Secret#124' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(confirmPasswordResetByCode).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountButton', () => {
  it('is disabled and marked coming soon', () => {
    render(<DeleteAccountButton />);
    const button = screen.getByRole('button', { name: /Delete account/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Coming soon');
  });
});
