import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SITE_SEARCH_DEBOUNCE_MS } from '../../utils/siteSearch';

const { searchSite, profileImageFetch, askSite } = vi.hoisted(() => ({
  searchSite: vi.fn(),
  profileImageFetch: vi.fn(),
  askSite: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  searchSite: (...args: unknown[]) => searchSite(...args),
  profileImageFetch: (...args: unknown[]) => profileImageFetch(...args),
  askSite: (...args: unknown[]) => askSite(...args),
}));

import SiteSearchBox from './SiteSearchBox';

const sample = {
  experts: [{ id: 'exp-42', name: 'Ada Lovelace', title: 'Professor' }],
  seminars: [{ id: 'sem-7', name: 'Cells', description: 'Live session' }],
  students: [],
  yours: [],
  pages: [{ title: 'Connect to Knowledge Across the Globe', snippet: 'Civil Engineering', route: '/' }],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="where">
      {`${location.pathname}${location.search}|${(location.state as any)?.searchHeading ?? ''}`}
    </div>
  );
}

function renderSearch(userDetails: Record<string, unknown> | null) {
  const store = configureStore({ reducer: { auth: () => ({ userDetails }) } });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/aboutus']}>
        <SiteSearchBox audience="public" />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

async function search(value: string) {
  fireEvent.change(screen.getByLabelText('Search WisdomLinked'), { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SITE_SEARCH_DEBOUNCE_MS);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SiteSearchBox on a public page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchSite.mockReset();
    searchSite.mockResolvedValue(sample);
    profileImageFetch.mockResolvedValue(null);
    askSite.mockResolvedValue({ answer: '' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a signed-in student straight to their dashboard, not to Login', async () => {
    renderSearch({ email: 's@test.com', role: 'customer' });
    await search('civil');
    expect(screen.getByRole('link', { name: /Ada Lovelace/ })).toHaveAttribute('href', '/user/studentdashboard?expert=exp-42');
    expect(screen.getByRole('link', { name: /Cells/ })).toHaveAttribute('href', '/user/studentdashboard?seminar=sem-7');
  });

  it('gives a signed-in expert the same results as their dashboard search, with no Login links', async () => {
    renderSearch({ email: 'e@test.com', role: 'expert' });
    await search('civil');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ada Lovelace/ })).toBeNull();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') || '');
    expect(hrefs.some((h) => h.startsWith('/login'))).toBe(false);
  });

  it('still sends a visitor through Login', async () => {
    renderSearch(null);
    await search('civil');
    expect(screen.getByRole('link', { name: /Ada Lovelace/ }).getAttribute('href')).toMatch(/^\/login\?redirect=/);
  });

  it('opens a Pages result on its page and names the heading to scroll to', async () => {
    renderSearch({ email: 's@test.com', role: 'customer' });
    await search('civil');
    fireEvent.click(screen.getByRole('link', { name: /Connect to Knowledge Across the Globe/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/|Connect to Knowledge Across the Globe');
  });
});
