import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PrivateRoute } from './App';

function LoginProbe() {
  const location = useLocation();
  return <div data-testid="login-location">{`${location.pathname}${location.search}`}</div>;
}

describe('PrivateRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sends a logged-out visit to /user/studentdashboard to bare /login and drops the query', () => {
    const store = configureStore({
      reducer: {
        auth: () => ({ userDetails: null }),
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/user/studentdashboard?expert=exp-42&seminar=sem-7']}>
          <Routes>
            <Route
              path="/user/studentdashboard"
              element={
                <PrivateRoute>
                  <div>student dashboard</div>
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByTestId('login-location').textContent).toBe('/login');
    expect(screen.queryByText('student dashboard')).not.toBeInTheDocument();
  });
});
