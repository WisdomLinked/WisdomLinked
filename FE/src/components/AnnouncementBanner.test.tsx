import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnnouncementBanner, { DISMISSED_ANNOUNCEMENT_ID_KEY } from './AnnouncementBanner';

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

  it('hides when the API returns null (no active announcement)', async () => {
    mockedGet.mockResolvedValue(null);
    renderBanner();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
  });

  it('hides after wl-announcement-change when the API returns null', async () => {
    mockedGet.mockResolvedValueOnce(active).mockResolvedValueOnce(null);
    renderBanner();
    expect(await screen.findByRole('region', { name: 'Announcement' })).toHaveTextContent(
      'New seminar this Friday',
    );
    window.dispatchEvent(new Event('wl-announcement-change'));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
    });
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
