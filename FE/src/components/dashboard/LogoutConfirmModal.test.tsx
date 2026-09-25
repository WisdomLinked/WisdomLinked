import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LogoutConfirmModal from './LogoutConfirmModal';

describe('LogoutConfirmModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <LogoutConfirmModal open={false} onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('asks about logging out, with both choices', () => {
    render(<LogoutConfirmModal open onCancel={() => {}} onConfirm={() => {}} />);

    expect(screen.getByText(/log out of WisdomLinked/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('logs out only when Logout is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<LogoutConfirmModal open onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels without logging out when Cancel is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<LogoutConfirmModal open onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels on a click outside the card, but not on one inside it', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutConfirmModal open onCancel={onCancel} onConfirm={onConfirm} />);

    const overlay = screen.getByRole('dialog');
    fireEvent.click(screen.getByText(/log out of WisdomLinked/i));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('paints the Logout button with a red this project actually defines', () => {
    render(<LogoutConfirmModal open onCancel={() => {}} onConfirm={() => {}} />);

    const logout = screen.getByRole('button', { name: 'Logout' });
    expect(logout.className).toMatch(/(^|\s)bg-red(\s|$)/);
    expect(logout.className).not.toMatch(/bg-red-\d/);
    expect(logout.className).toContain('text-white');
  });
});
