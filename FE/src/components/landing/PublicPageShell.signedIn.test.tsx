import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../search/SiteSearchBox', () => ({ default: () => <div data-testid="search" /> }));
vi.mock('../SignupModal', () => ({ default: () => <div data-testid="signup-modal" /> }));

import PublicPageShell from './PublicPageShell';
import { dashboardPathForRole } from '../../hooks/useSignedInUser';

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderShell(userDetails: Record<string, unknown> | null) {
  const store = configureStore({ reducer: { auth: () => ({ userDetails }) } });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route
            path="*"
            element={
              <PublicPageShell>
                <Where />
              </PublicPageShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('PublicPageShell header', () => {
  it('shows a signed-in user a Dashboard button instead of Login and Sign Up', () => {
    renderShell({ email: 's@test.com', role: 'customer' });
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign Up' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/user/studentdashboard');
  });

  it('keeps Login and Sign Up for a visitor', () => {
    renderShell(null);
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull();
  });

  it('offers Dashboard in the mobile menu too', () => {
    renderShell({ email: 'e@test.com', role: 'expert' });
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dashboards = screen.getAllByRole('button', { name: 'Dashboard' });
    expect(dashboards).toHaveLength(2);
    fireEvent.click(dashboards[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('/user/expertdashboard');
  });
});

describe('dashboardPathForRole', () => {
  it('sends each role to its own dashboard', () => {
    expect(dashboardPathForRole('customer')).toBe('/user/studentdashboard');
    expect(dashboardPathForRole('expert')).toBe('/user/expertdashboard');
    expect(dashboardPathForRole('admin')).toBe('/user/admindashboard');
    expect(dashboardPathForRole(undefined)).toBe('/user/studentdashboard');
  });
});
