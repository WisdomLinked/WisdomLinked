import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSeminars from './StudentSeminars';

const { doFilterSeminars, doGetKeywordsAndServices } = vi.hoisted(() => ({
  doFilterSeminars: vi.fn(),
  doGetKeywordsAndServices: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  doFilterSeminars: (...args: unknown[]) => doFilterSeminars(...args),
  doGetKeywordsAndServices: (...args: unknown[]) => doGetKeywordsAndServices(...args),
  getExpertById: vi.fn(async () => ({ result: { groupChats: [] } })),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  registerForSeminar: vi.fn(),
  requestSeminarSeat: vi.fn(),
  paySeminarSeatRequest: vi.fn(),
  quoteBookingCharge: vi.fn(async () => null),
}));

vi.mock('../../api/chatApi', () => ({
  fetchChatUserProfile: vi.fn(async () => ({ success: false })),
}));

function seminar(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'sem-1',
    name: 'Essay workshop',
    description: 'Writing',
    start: new Date(Date.now() + 86_400_000).toISOString(),
    end: new Date(Date.now() + 86_400_000 + 90 * 60_000).toISOString(),
    duration: 90,
    image: 'https://cdn.example.com/cover.jpg',
    admin: { _id: 'host-1', username: 'Host' },
    participants: ['host-1'],
    price: 25,
    currency: 'USD',
    keywords: [],
    services: [],
    maxAttendees: 20,
    ...overrides,
  };
}

function renderPage(groupChats: Array<{ type: string; _id: string; price?: number }> = []) {
  const store = configureStore({
    reducer: {
      auth: () => ({ userDetails: { keywords: [], groupChats } }),
    },
  });
  return render(
    <Provider store={store}>
      <StudentSeminars onEnterSeminarChat={vi.fn()} />
    </Provider>,
  );
}

describe('StudentSeminars card price', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    doFilterSeminars.mockReset();
    doGetKeywordsAndServices.mockReset();
    doGetKeywordsAndServices.mockResolvedValue({ keywords: [], services: [] });
  });

  it('shows the advertised per-seat price and duration', async () => {
    doFilterSeminars.mockResolvedValue({ result: [seminar()] });
    renderPage();
    expect(await screen.findByText('Per seat')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('· 1.5 hr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('shows Free for a $0 seminar', async () => {
    doFilterSeminars.mockResolvedValue({ result: [seminar({ price: 0 })] });
    renderPage();
    expect(await screen.findByText('Free')).toBeInTheDocument();
    expect(screen.queryByText('· 1.5 hr')).toBeNull();
  });

  it('keeps the price on a registered seminar as You paid', async () => {
    doFilterSeminars.mockResolvedValue({ result: [seminar()] });
    renderPage([{ type: 'seminar', _id: 'sem-1', price: 25 }]);
    expect(await screen.findByText('You paid')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter chat' })).toBeInTheDocument();
  });
});
