import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import StudentCalendar, { type Meeting } from './StudentCalendar';

vi.mock('../../pages/Dashboard/seminarDetails', () => ({
  default: ({ title }: any) => <div data-testid="seminar-details">{title}</div>,
}));

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const DAY = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 3 * DAY);
const upcoming = new Date(Date.now() + 3 * DAY);
past.setHours(14, 0, 0, 0);
upcoming.setHours(14, 0, 0, 0);

const meeting = (when: Date, overrides: Partial<Meeting> = {}): Meeting => ({
  id: `m-${when.getTime()}`,
  title: 'Career Chat',
  date: ymd(when),
  time: '14:00',
  with: 'Mentor: Dr. Smith',
  location: 'Online · WisdomLinked Room',
  type: 'session',
  status: 'confirmed',
  raw: {
    name: 'Career Chat',
    start: when.toISOString(),
    end: new Date(when.getTime() + 60 * 60 * 1000).toISOString(),
    duration: 60,
    type: 'individual',
  },
  ...overrides,
});

const openDay = (when: Date) => {
  const cell = screen
    .getAllByRole('button')
    .find(b => b.textContent?.startsWith(String(when.getDate())) && b.textContent.includes('Career Chat'));
  if (!cell) throw new Error('day cell not found');
  fireEvent.click(cell);
  return screen.getByText('Meetings').closest('div.w-full') as HTMLElement;
};

const navigateTo = (when: Date) => {
  const now = new Date();
  const diff = (when.getFullYear() - now.getFullYear()) * 12 + (when.getMonth() - now.getMonth());
  for (let i = 0; i < Math.abs(diff); i += 1) {
    fireEvent.click(screen.getByRole('button', { name: diff < 0 ? 'Previous month' : 'Next month' }));
  }
};

describe('StudentCalendar day list — View details', () => {
  it('shows View details on a past meeting for a student', () => {
    render(<StudentCalendar meetings={[meeting(past)]} onJoinMeeting={vi.fn()} />);
    navigateTo(past);
    const modal = openDay(past);
    expect(within(modal).getByText('View details →')).toBeTruthy();
    expect(within(modal).queryByRole('button', { name: /join chat/i })).toBeNull();
  });

  it('keeps Join (not View details) on an upcoming meeting for a student', () => {
    render(<StudentCalendar meetings={[meeting(upcoming)]} onJoinMeeting={vi.fn()} />);
    navigateTo(upcoming);
    const modal = openDay(upcoming);
    expect(within(modal).queryByText('View details →')).toBeNull();
    expect(within(modal).getByRole('button', { name: /join chat/i })).toBeTruthy();
  });
});

describe('StudentCalendar cancelled meetings', () => {
  it('labels a past cancelled 1:1 as Cancelled 1-1 in the day list', () => {
    render(<StudentCalendar meetings={[meeting(past, { status: 'cancelled' })]} />);
    navigateTo(past);
    const modal = openDay(past);
    expect(within(modal).getByText('Cancelled 1-1')).toBeTruthy();
    expect(within(modal).queryByText('Past 1-1')).toBeNull();
  });

  it('labels a cancelled seminar as Cancelled seminar', () => {
    render(
      <StudentCalendar
        meetings={[meeting(past, { status: 'cancelled', type: 'seminar', raw: { ...meeting(past).raw, type: 'seminar' } })]}
      />,
    );
    navigateTo(past);
    const modal = openDay(past);
    expect(within(modal).getByText('Cancelled seminar')).toBeTruthy();
  });

  it('shows Cancelled in red in the details popup of a cancelled meeting', () => {
    render(<StudentCalendar meetings={[meeting(past, { status: 'cancelled' })]} />);
    fireEvent.click(screen.getAllByText('Career Chat')[0]);
    const dialog = screen.getByRole('dialog', { name: /session details/i });
    const label = within(dialog).getByText('Cancelled');
    expect(label.className).toMatch(/text-rose-600/);
    expect(label.className).not.toMatch(/text-red-\d/);
  });

  it('does not show Cancelled in the popup of a meeting that was not cancelled', () => {
    render(<StudentCalendar meetings={[meeting(past)]} />);
    fireEvent.click(screen.getAllByText('Career Chat')[0]);
    const dialog = screen.getByRole('dialog', { name: /session details/i });
    expect(within(dialog).queryByText('Cancelled')).toBeNull();
  });

  it('marks a cancelled meeting in the past meetings list', () => {
    render(<StudentCalendar meetings={[meeting(past, { status: 'cancelled' })]} />);
    expect(screen.getByText('Cancelled 1-1')).toBeTruthy();
  });

  it('never offers Join on a cancelled meeting that is still in the future', () => {
    const onJoinMeeting = vi.fn();
    render(<StudentCalendar meetings={[meeting(upcoming, { status: 'cancelled' })]} onJoinMeeting={onJoinMeeting} />);

    expect(screen.queryByRole('button', { name: /join chat/i })).toBeNull();
    expect(screen.getByText('Cancelled 1-1')).toBeTruthy();

    fireEvent.click(screen.getAllByText('Career Chat')[0]);
    const dialog = screen.getByRole('dialog', { name: /session details/i });
    expect(within(dialog).queryByRole('button', { name: /join chat/i })).toBeNull();
    expect(within(dialog).getByText('Cancelled')).toBeTruthy();

    navigateTo(upcoming);
    const modal = openDay(upcoming);
    expect(within(modal).queryByRole('button', { name: /join chat/i })).toBeNull();
    expect(within(modal).getByText('View details →')).toBeTruthy();
  });

  it('labels a cancelled meeting Cancelled 1-1 for the expert too', () => {
    render(<StudentCalendar mode="expert" onSelectMeeting={vi.fn()} meetings={[meeting(past, { status: 'cancelled' })]} />);
    navigateTo(past);
    const modal = openDay(past);
    expect(within(modal).getByText('Cancelled 1-1')).toBeTruthy();
  });
});
