import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Resources from '../pages/Resources';
import ResourceGuides from '../pages/ResourceGuides';
import ResourceGuideRedirect from '../pages/ResourceGuideRedirect';

let storeState: any;

vi.mock('../store', () => ({
  useAppSelector: (fn: any) => fn(storeState),
}));

function LocationProbe() {
  const { pathname, hash } = useLocation();
  return <output data-testid="location">{`${pathname}${hash}`}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/guides" element={<ResourceGuides />} />
        <Route path="/resources/:slug" element={<ResourceGuideRedirect />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  storeState = { auth: { userDetails: {} } };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Resources timeline', () => {
  it('renders the hero, seven stage sections in an ordered list and the timeline nav', () => {
    renderAt('/resources');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your path to graduate study in the U.S.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start with stage 1' })).toHaveAttribute('href', '#shortlist-programs');

    const stages = screen.getAllByRole('region').filter((el) => el.tagName === 'SECTION');
    expect(stages).toHaveLength(7);
    for (const section of stages) {
      expect(within(section).getByRole('heading', { level: 2 })).toBeInTheDocument();
      expect(section.closest('li')?.parentElement?.tagName).toBe('OL');
    }
    expect(within(stages[0]).getByText('6–10')).toBeInTheDocument();

    const [rail] = screen.getAllByRole('navigation', { name: 'Your timeline' });
    expect(rail.querySelector('ol')).not.toBeNull();
    const items = within(rail).getAllByRole('link');
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveAttribute('href', '#shortlist-programs');
    expect(items[0]).toHaveAttribute('aria-current', 'step');
  });

  it('renders the 18-month plan chart with one link per stage', () => {
    renderAt('/resources');
    const chart = screen.getByRole('navigation', { name: '18-month plan' });
    const rows = within(chart).getAllByRole('link');
    expect(rows).toHaveLength(7);
    expect(rows[4]).toHaveAttribute('href', '#funding-and-offers');
    expect(within(chart).getByText('Start')).toBeInTheDocument();
  });

  it('opens external links in a new tab with screen-reader text', () => {
    renderAt('/resources');
    const link = screen.getByRole('link', { name: /EducationUSA/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(link).getByText('(opens in a new tab)')).toHaveClass('sr-only');
  });

  it('links "April 15" inline', () => {
    renderAt('/resources');
    const link = screen.getByRole('link', { name: /^April 15/ });
    expect(link.getAttribute('href')).toContain('april-15-resolution');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('asks logged-out visitors to log in to see guides', () => {
    renderAt('/resources');
    const button = screen.getByRole('link', { name: 'Log in to see all guides' });
    expect(button.getAttribute('href')).toContain('/login');
    expect(button.getAttribute('href')).toContain(encodeURIComponent('/resources/guides'));
  });

  it('links logged-in users straight to the guides page', () => {
    storeState = { auth: { userDetails: { _id: 'u1', role: 'customer' } } };
    renderAt('/resources');
    expect(screen.getByRole('link', { name: 'See all guides' })).toHaveAttribute('href', '/resources/guides');
  });
});

describe('Combined guides page', () => {
  it('renders both guides as h2 blocks with their sections', async () => {
    renderAt('/resources/guides');
    expect(screen.getByRole('heading', { level: 1, name: 'Guides for students' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Graduate School Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Scholarship Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Choosing a Program' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to resources/ })).toHaveAttribute('href', '/resources');
  });

  it('redirects an old guide URL to its anchor on the combined page', async () => {
    renderAt('/resources/scholarship-guide');
    expect(await screen.findByRole('heading', { level: 2, name: 'Scholarship Guide' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/resources/guides#scholarship-guide');
  });

  it('redirects an unknown slug to the combined page', async () => {
    renderAt('/resources/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Guides for students' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/resources\/guides$/);
  });
});
