import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSeminars from './StudentSeminars';

const { doFilterSeminars, doGetKeywordsAndServices, getExpertById } = vi.hoisted(() => ({
  doFilterSeminars: vi.fn(),
  doGetKeywordsAndServices: vi.fn(),
  getExpertById: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  doFilterSeminars: (...args: unknown[]) => doFilterSeminars(...args),
  doGetKeywordsAndServices: (...args: unknown[]) => doGetKeywordsAndServices(...args),
  getExpertById: (...args: unknown[]) => getExpertById(...args),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  registerForSeminar: vi.fn(),
  requestSeminarSeat: vi.fn(),
  paySeminarSeatRequest: vi.fn(),
}));

vi.mock('../../api/chatApi', () => ({
  fetchChatUserProfile: vi.fn(async () => ({ success: false })),
}));

const seminarRow = {
  _id: 'occ-1',
  seriesId: 'series-9',
  name: 'Cell seminar',
  description: 'Cells',
  start: new Date(Date.now() + 86_400_000).toISOString(),
  image: 'https://cdn.example.com/bucket/chatFiles/cover.jpg',
  admin: { _id: 'host-1', username: 'Host', image: 'host.png' },
  participants: ['host-1'],
  price: 10,
  keywords: [{ value: 'Biology' }],
  services: [],
  maxAttendees: 20,
};

function renderSeminars(props: { initialQuery?: string; openSeminarId?: string | null } = {}) {
  const store = configureStore({
    reducer: {
      auth: () => ({ userDetails: { keywords: [], groupChats: [] } }),
    },
  });
  return render(
    <Provider store={store}>
      <StudentSeminars {...props} />
    </Provider>,
  );
}

describe('StudentSeminars global search', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    doFilterSeminars.mockReset();
    doGetKeywordsAndServices.mockReset();
    getExpertById.mockReset();
    doFilterSeminars.mockResolvedValue({ result: [seminarRow] });
    doGetKeywordsAndServices.mockResolvedValue({
      keywords: [{ _id: 'k1', value: 'Biology' }],
      services: [],
    });
    getExpertById.mockResolvedValue({ result: { groupChats: [] } });
  });

  it('opens the seminar detail for the series id and does not call getExpertById with that id', async () => {
    renderSeminars({ openSeminarId: 'series-9' });
    expect(await screen.findByRole('button', { name: /Back to seminars/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cell seminar' })).toBeInTheDocument();
    expect(window.localStorage.getItem('wl_open_seminar_id')).toBeNull();
    expect(window.localStorage.getItem('student_booking')).toBeNull();
    await waitFor(() => {
      expect(getExpertById).toHaveBeenCalled();
    });
    const ids = getExpertById.mock.calls.map((call) => call[0]);
    expect(ids).not.toContain('series-9');
    expect(ids).not.toContain('occ-1');
    expect(ids).not.toContain('stu-1');
    expect(ids).toContain('host-1');
  });

  it('prefills the seminar query and leaves the major filter in place', async () => {
    const view = renderSeminars({ initialQuery: 'biology' });
    expect(await screen.findByPlaceholderText(/Search by seminar title/i)).toHaveValue('biology');

    fireEvent.click(screen.getByRole('button', { name: 'All majors' }));
    fireEvent.click(screen.getByRole('option', { name: 'Biology' }));
    expect(screen.getByRole('button', { name: 'Biology' })).toBeInTheDocument();

    view.rerender(
      <Provider
        store={configureStore({
          reducer: { auth: () => ({ userDetails: { keywords: [], groupChats: [] } }) },
        })}
      >
        <StudentSeminars initialQuery="chemistry" />
      </Provider>,
    );

    expect(screen.getByPlaceholderText(/Search by seminar title/i)).toHaveValue('chemistry');
    expect(screen.getByRole('button', { name: 'Biology' })).toBeInTheDocument();
  });
});
