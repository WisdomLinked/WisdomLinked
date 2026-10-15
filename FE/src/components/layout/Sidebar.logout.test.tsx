import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

describe('the sidebar Logout', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('hands logout to the dashboard and does not leave the page on its own', () => {
    const onNavigate = vi.fn();
    render(<Sidebar activeItem="dashboard" onNavigate={onNavigate} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Logout' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, log out' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('logout');
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yes, log out' })).not.toBeInTheDocument();
  });

  it('does nothing when the confirmation is cancelled', () => {
    const onNavigate = vi.fn();
    render(<Sidebar activeItem="dashboard" onNavigate={onNavigate} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Logout' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
