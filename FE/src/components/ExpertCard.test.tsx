import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExpertCard, { type ExpertCardProps } from './ExpertCard';

const base: ExpertCardProps = {
  id: 'e1',
  name: 'Ada Expert',
  title: 'Advisor',
  institution: 'WisdomLinked',
  field: 'CS',
  experience: '—',
  services: ['Study Abroad'],
  image: null,
  isNew: false,
  status: 'active',
};

describe('ExpertCard price footer', () => {
  it('shows the lowest hourly rate next to View Profile', () => {
    render(<ExpertCard {...base} price={[80, 45]} onViewProfile={vi.fn()} />);
    expect(screen.getByText('Starting at')).toBeInTheDocument();
    expect(screen.getByText('$45')).toBeInTheDocument();
    expect(screen.getByText('/ hr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Profile' })).toBeInTheDocument();
  });

  it('shows Free when the published rate is 0', () => {
    render(<ExpertCard {...base} price={0} onViewProfile={vi.fn()} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.queryByText('/ hr')).toBeNull();
  });

  it('omits the price tag when the expert has no rate', () => {
    render(<ExpertCard {...base} onViewProfile={vi.fn()} />);
    expect(screen.queryByText('Starting at')).toBeNull();
    expect(screen.getByRole('button', { name: 'View Profile' })).toBeInTheDocument();
  });
});
