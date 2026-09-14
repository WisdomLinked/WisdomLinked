import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnnouncementBanner, {
  DISMISSED_ANNOUNCEMENT_ID_KEY,
  DUMMY_ANNOUNCEMENT,
} from './AnnouncementBanner';

vi.mock('../api/api', () => ({
  getActiveAnnouncement: vi.fn(),
}));

import { getActiveAnnouncement } from '../api/api';

const mockedGet = vi.mocked(getActiveAnnouncement);

const active = {
  id: 'ann-1',
  message: 'New seminar this Friday',
  link: '/seminars',
  linkLabel: 'Learn more',
  active: true,
};

function renderBanner() {
  return render(
    <MemoryRouter>
      <AnnouncementBanner />
    </MemoryRouter>,
  );
}

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('falls back to the dummy announcement when the API returns null', async () => {
    mockedGet.mockResolvedValue(null);
    renderBanner();
    expect(await screen.findByRole('region', { name: 'Announcement' })).toHaveTextContent(
      DUMMY_ANNOUNCEMENT.message,
    );
  });

  it('hides when the stored dismissed id matches the current announcement', async () => {
    localStorage.setItem(DISMISSED_ANNOUNCEMENT_ID_KEY, 'ann-1');
    mockedGet.mockResolvedValue(active);
    renderBanner();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
  });

  it('shows again when the admin publishes a new announcement id', async () => {
    localStorage.setItem(DISMISSED_ANNOUNCEMENT_ID_KEY, 'ann-1');
    mockedGet.mockResolvedValue({
      ...active,
      id: 'ann-2',
      message: 'A new mentor joined this week',
    });
    renderBanner();
    expect(await screen.findByRole('region', { name: 'Announcement' })).toHaveTextContent(
      'A new mentor joined this week',
    );
    expect(screen.getByRole('link', { name: /Learn more/i })).toHaveAttribute('href', '/seminars');
  });

  it('stores the announcement id and unmounts on dismiss', async () => {
    mockedGet.mockResolvedValue(active);
    renderBanner();
    const dismiss = await screen.findByRole('button', { name: 'Dismiss announcement' });
    fireEvent.click(dismiss);
    expect(localStorage.getItem(DISMISSED_ANNOUNCEMENT_ID_KEY)).toBe('ann-1');
    expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
  });
});
