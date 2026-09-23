import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Resources from '../pages/Resources';
import ResourceGuide from '../pages/ResourceGuide';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:slug" element={<ResourceGuide />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Resources pages', () => {
  it('lists dummy guides with links to their slugs', async () => {
    renderAt('/resources');
    expect(await screen.findByRole('heading', { level: 1, name: 'Guides for students' })).toBeInTheDocument();
    const grad = await screen.findByRole('link', { name: /Graduate School Guide/i });
    const scholarship = screen.getByRole('link', { name: /Scholarship Guide/i });
    expect(grad).toHaveAttribute('href', '/resources/graduate-school-guide');
    expect(scholarship).toHaveAttribute('href', '/resources/scholarship-guide');
  });

  it('renders section headings on a guide detail page', async () => {
    renderAt('/resources/graduate-school-guide');
    expect(await screen.findByRole('heading', { level: 1, name: 'Graduate School Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Choosing a Program' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Building a Strong SOP' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Requesting Letters of Recommendation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Federal Student Aid' })).toHaveAttribute(
      'href',
      'https://studentaid.gov/',
    );
  });

  it('shows not-found copy for an unknown slug', async () => {
    renderAt('/resources/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Guide not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All guides/i })).toHaveAttribute('href', '/resources');
  });
});
