import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResourcesBand from './ResourcesBand';

const renderBand = () =>
  render(
    <MemoryRouter>
      <ResourcesBand />
    </MemoryRouter>,
  );

describe('ResourcesBand', () => {
  it('is a labelled section with a heading', () => {
    renderBand();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(screen.getByRole('region', { name: heading.textContent ?? '' })).toBeInTheDocument();
  });

  it('links each category to its real Resources section, named by its label', () => {
    renderBand();
    const list = screen.getByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Shortlist programs' })).toHaveAttribute('href', '/resources#shortlist-programs');
    expect(screen.getByRole('link', { name: 'Application guide' })).toHaveAttribute(
      'href',
      '/resources/guides#graduate-school-guide',
    );
    expect(screen.getByRole('link', { name: 'Scholarships' })).toHaveAttribute('href', '/resources/guides#scholarship-guide');
    expect(screen.getByRole('link', { name: 'Student visa' })).toHaveAttribute('href', '/resources#student-visa');
    expect(screen.getByRole('link', { name: 'Student visa' })).toHaveAccessibleDescription('F-1 step by step');
  });

  it('links to the main Resources page', () => {
    renderBand();
    expect(screen.getByRole('link', { name: /Browse all resources/ })).toHaveAttribute('href', '/resources');
  });
});
