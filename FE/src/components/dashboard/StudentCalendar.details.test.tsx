import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import StudentCalendar, { type Meeting } from './StudentCalendar';

vi.mock('../../pages/Dashboard/seminarDetails', () => ({
  default: ({ title, description }: any) => (
    <div data-testid="seminar-details">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const upcoming = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'm-1',
  title: 'Research Methods',
  date: ymd(upcoming),
  time: '14:00',
  with: 'Mentor: Dr. Smith',
  location: 'Online · WisdomLinked Room',
  type: 'seminar',
  status: 'confirmed',
  raw: {
    name: 'Research Methods',
    description: 'A seminar on research design',
    start: upcoming.toISOString(),
    duration: 60,
    admin: { username: 'Dr. Smith' },
    participants: [],
    type: 'seminar',
  },
  ...overrides,
});

describe('StudentCalendar meeting details', () => {
  // Student mode used to gate every detail click on `isExpert`, so clicking a
  // meeting as a student did nothing at all.
  it('opens details when a student clicks an upcoming meeting', () => {
    render(<StudentCalendar meetings={[meeting()]} />);

    expect(screen.queryByTestId('seminar-details')).toBeNull();
    fireEvent.click(screen.getByText('Research Methods'));

    expect(screen.getByTestId('seminar-details')).toBeTruthy();
    expect(screen.getByText('A seminar on research design')).toBeTruthy();
  });

  it('opens details when a student clicks a past meeting', () => {
    const m = meeting({
      id: 'm-past',
      date: ymd(past),
      raw: { ...meeting().raw, start: past.toISOString() },
    });
    render(<StudentCalendar meetings={[m]} />);

    fireEvent.click(screen.getByText('Research Methods'));
    expect(screen.getByTestId('seminar-details')).toBeTruthy();
  });

  it('defers to the caller instead of opening its own modal in expert mode', () => {
    const onSelectMeeting = vi.fn();
    render(
      <StudentCalendar mode="expert" meetings={[meeting()]} onSelectMeeting={onSelectMeeting} />,
    );

    fireEvent.click(screen.getByText('Research Methods'));

    expect(onSelectMeeting).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('seminar-details')).toBeNull();
  });

  it('joining from a card does not also open the details modal', () => {
    const onJoinMeeting = vi.fn();
    render(<StudentCalendar meetings={[meeting()]} onJoinMeeting={onJoinMeeting} />);

    fireEvent.click(screen.getAllByRole('button', { name: /join seminar chat/i })[0]);

    expect(onJoinMeeting).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('seminar-details')).toBeNull();
  });

  it('still shows what it knows when a meeting has no source record', () => {
    render(<StudentCalendar meetings={[meeting({ raw: undefined })]} />);

    fireEvent.click(screen.getByText('Research Methods'));

    const dialog = screen.getByRole('dialog', { name: /seminar details/i });
    expect(within(dialog).queryByTestId('seminar-details')).toBeNull();
    expect(within(dialog).getByText('Mentor: Dr. Smith')).toBeTruthy();
  });

  it('closes the details modal again', () => {
    render(<StudentCalendar meetings={[meeting()]} />);

    fireEvent.click(screen.getByText('Research Methods'));
    expect(screen.getByTestId('seminar-details')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('seminar-details')).toBeNull();
  });
});

describe('StudentCalendar past/upcoming split', () => {
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

  const atTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const running = inMinutes(-10);
  const finished = inMinutes(-180);

  it('keeps a session that is under way out of the past list', () => {
    const m = meeting({
      id: 'running',
      date: ymd(running),
      time: atTime(running),
      raw: { ...meeting().raw, start: running.toISOString(), duration: 60 },
    });
    render(<StudentCalendar meetings={[m]} />);

    expect(screen.getByText('No past meetings yet.')).toBeInTheDocument();
  });

  it('moves a finished session into the past list', () => {
    const m = meeting({
      id: 'finished',
      date: ymd(finished),
      time: atTime(finished),
      raw: { ...meeting().raw, start: finished.toISOString(), duration: 60 },
    });
    render(<StudentCalendar meetings={[m]} />);

    expect(screen.queryByText('No past meetings yet.')).not.toBeInTheDocument();
  });
});
