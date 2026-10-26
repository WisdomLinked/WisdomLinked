import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedRoutes } from './App';

const api = vi.hoisted(() => ({
  getRequiredContracts: vi.fn(),
}));

vi.mock('./api/termsApi', () => ({
  getRequiredContracts: (...args: unknown[]) => api.getRequiredContracts(...args),
  acceptTerms: vi.fn(),
}));

vi.mock('./pages/Dashboard/_CustomerDashboard', () => ({
  default: () => <div>Legacy student dashboard</div>,
}));

vi.mock('./pages/Dashboard/_ExpertDashboard', () => ({
  default: () => <div>Legacy expert dashboard</div>,
}));

vi.mock('./pages/AdminDashboard', () => ({
  default: () => <div>Admin dashboard body</div>,
}));

vi.mock('./pages/StudentDashboard', () => ({
  default: () => <div>Student dashboard body</div>,
}));

vi.mock('./pages/ExpertDashboard', () => ({
  default: () => <div>Expert dashboard body</div>,
}));

const unsignedShared = {
  audience: 'shared',
  version: 2,
  html: '<p>Please sign the shared agreement</p>',
  contentHash: 'abc',
  originalFilename: 'shared.docx',
};

function renderShell(path: string) {
  window.localStorage.setItem('currentUser', JSON.stringify({ email: 'ada@example.com', role: 'customer' }));
  const store = configureStore({
    reducer: {
      auth: () => ({ userDetails: { email: 'ada@example.com', role: 'customer', username: 'Ada' } }),
      app: () => ({ loading: false }),
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Suspense fallback={<div>route loading</div>}>
          <AuthenticatedRoutes />
        </Suspense>
      </MemoryRouter>
    </Provider>,
  );
}

describe('legacy dashboard terms gate', () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.getRequiredContracts.mockReset();
    api.getRequiredContracts.mockResolvedValue([unsignedShared]);
  });

  it('gates a legacy customer route until the shared contract is signed', async () => {
    renderShell('/customerdashboard/chat');
    expect(await screen.findByText('Please sign the shared agreement')).toBeInTheDocument();
    expect(screen.queryByText('Legacy student dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip|dismiss|not now|close/i })).not.toBeInTheDocument();
  });

  it('gates a legacy expert route until the shared contract is signed', async () => {
    renderShell('/expertdashboard-legacy/calendar');
    expect(await screen.findByText('Please sign the shared agreement')).toBeInTheDocument();
    expect(screen.queryByText('Legacy expert dashboard')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip|dismiss|not now|close/i })).not.toBeInTheDocument();
  });

  it('leaves the admin dashboard ungated', async () => {
    renderShell('/admindashboard');
    expect(await screen.findByText('Admin dashboard body')).toBeInTheDocument();
    expect(screen.queryByText('Please sign the shared agreement')).not.toBeInTheDocument();
  });
});
