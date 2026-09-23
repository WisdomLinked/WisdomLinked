import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const COVER = 'https://cdn.example.com/bucket/chatFiles/cover.jpg';

const sample = {
  experts: [{ id: 'exp-42', name: 'Ada Lovelace', title: 'Professor', image: 'expert.jpg' }],
  seminars: [{
    id: 'sem-7',
    name: 'Cells',
    description: 'Live session',
    image: COVER,
    hostImage: 'host.png',
  }],
  students: [{ id: 'stu-1', name: 'Sam Student', image: 'student.png', degreeSought: 'MS' }],
  yours: [],
  pages: [{ title: 'About us', snippet: 'Connected to knowledge', route: '/aboutus' }],
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
}

async function typeQuery(value: string) {
  fireEvent.change(screen.getByLabelText('Search WisdomLinked'), { target: { value } });
}

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SITE_SEARCH_DEBOUNCE_MS);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SiteSearchBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchSite.mockReset();
    profileImageFetch.mockReset();
    askSite.mockReset();
    askSite.mockResolvedValue({ answer: '', similarQuestions: [] });
    profileImageFetch.mockImplementation(async (file: string) => `data:image/png;base64,${file}`);
    searchSite.mockResolvedValue(sample);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('homepage search encodes the expert redirect and does not link to the dashboard url', async () => {
    render(
      <MemoryRouter>
        <SiteSearchBox audience="public" />
      </MemoryRouter>,
    );
    await typeQuery('ada');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SITE_SEARCH_DEBOUNCE_MS - 1);
    });
    expect(searchSite).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(searchSite).toHaveBeenCalledWith('ada');

    const expert = screen.getByRole('link', { name: /Ada Lovelace/i });
    const href = expert.getAttribute('href') || '';
    expect(href.startsWith('/login?redirect=')).toBe(true);
    expect(href).not.toContain('/user/studentdashboard?expert=');
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect([...params.keys()]).toEqual(['redirect']);
    expect(params.has('expert')).toBe(false);
    expect(params.get('redirect')).toBe('/user/studentdashboard?expert=exp-42');

    const seminar = screen.getByRole('link', { name: /Cells/i });
    const seminarHref = seminar.getAttribute('href') || '';
    const seminarParams = new URLSearchParams(seminarHref.slice(seminarHref.indexOf('?') + 1));
    expect(seminarHref.startsWith('/login?redirect=')).toBe(true);
    expect([...seminarParams.keys()]).toEqual(['redirect']);
    expect(seminarParams.has('seminar')).toBe(false);
    expect(seminarParams.get('redirect')).toBe('/user/studentdashboard?seminar=sem-7');
  });

  it('resolves expert and host filenames with profileImageFetch and uses a chatFiles cover as img src', async () => {
    render(
      <MemoryRouter>
        <SiteSearchBox audience="public" />
      </MemoryRouter>,
    );
    await typeQuery('cells');
    await flushDebounce();

    const cover = screen.getByRole('img', { name: 'Cells cover' });
    expect(cover).toHaveAttribute('src', COVER);

    const expertImg = screen.getByRole('img', { name: 'Ada Lovelace' });
    const hostImg = screen.getByRole('img', { name: 'Cells host' });
    expect(expertImg.getAttribute('src')).toBe('data:image/png;base64,expert.jpg');
    expect(hostImg.getAttribute('src')).toBe('data:image/png;base64,host.png');
    expect(expertImg.getAttribute('src')).not.toBe('expert.jpg');
    expect(hostImg.getAttribute('src')).not.toBe('host.png');

    const fetched = profileImageFetch.mock.calls.map((call) => call[0]);
    expect(fetched).toContain('expert.jpg');
    expect(fetched).toContain('host.png');
    expect(fetched).not.toContain(COVER);
    for (const img of screen.getAllByRole('img')) {
      expect(img.getAttribute('src')).not.toBe('expert.jpg');
      expect(img.getAttribute('src')).not.toBe('host.png');
    }
  });

  it('keeps search cards on screen when a later request starts', async () => {
    let releaseSecond: (value: unknown) => void = () => {};
    searchSite.mockImplementation((q: string) => {
      if (q === 'first') return Promise.resolve(sample);
      return new Promise((resolve) => {
        releaseSecond = resolve;
      });
    });

    render(
      <MemoryRouter>
        <SiteSearchBox audience="public" />
      </MemoryRouter>,
    );
    await typeQuery('first');
    await flushDebounce();
    expect(screen.getByRole('link', { name: /Ada Lovelace/i })).toBeInTheDocument();

    await typeQuery('later');
    await flushDebounce();
    expect(searchSite).toHaveBeenCalledWith('later');
    expect(screen.getByRole('link', { name: /Ada Lovelace/i })).toBeInTheDocument();
    expect(screen.getByTestId('site-search-results')).toBeInTheDocument();

    await act(async () => {
      releaseSecond({
        experts: [],
        seminars: [],
        students: [],
        yours: [],
        pages: [],
      });
    });
  });

  it('sends an admin email query to user management and does not render a user directory', async () => {
    searchSite.mockResolvedValue({
      experts: [],
      seminars: [],
      students: [{ id: 'u1', name: 'Directory User', image: 'dir.png' }],
      yours: [],
      pages: [],
    });

    render(
      <MemoryRouter initialEntries={['/user/admindashboard']}>
        <Routes>
          <Route path="/user/admindashboard" element={<SiteSearchBox audience="admin" />} />
          <Route path="/user/admindashboard/usermgmt" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await typeQuery('ada@school.edu');
    await flushDebounce();

    const where = screen.getByTestId('where').textContent || '';
    expect(where.startsWith('/user/admindashboard/usermgmt?')).toBe(true);
    const params = new URLSearchParams(where.slice(where.indexOf('?') + 1));
    expect(params.get('email')).toBe('ada@school.edu');
    expect(searchSite).not.toHaveBeenCalled();
    expect(screen.queryByText('Directory User')).not.toBeInTheDocument();
    expect(screen.queryByText(/user directory/i)).not.toBeInTheDocument();
  });

  it('does not clear keyword cards when ask starts or the ask call throws', async () => {
    let rejectAsk: (reason?: unknown) => void = () => {};
    askSite.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectAsk = reject;
        }),
    );

    render(
      <MemoryRouter>
        <SiteSearchBox audience="public" />
      </MemoryRouter>,
    );
    await typeQuery('ada');
    await flushDebounce();
    expect(screen.getByRole('link', { name: /Ada Lovelace/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(askSite).toHaveBeenCalledWith('ada');
    expect(screen.getByRole('link', { name: /Ada Lovelace/i })).toBeInTheDocument();

    await act(async () => {
      rejectAsk(new Error('ask failed'));
    });
    expect(screen.getByRole('link', { name: /Ada Lovelace/i })).toBeInTheDocument();
    expect(screen.queryByTestId('site-search-answer')).not.toBeInTheDocument();
  });
});
