import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const session = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 'seminar-1',
  title: 'Intro to Quantum Computing',
  at: Date.now() + 48 * 3600_000,
  when: 'Thu, Oct 8, 6:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'Dr. Rivera',
  ...over,
});

const store = () =>
  configureStore({ reducer: { auth: () => ({ userDetails: { _id: 'me' } }) } });

const show = (
  sessions: UpcomingModalSession[],
  role: 'student' | 'expert' = 'student',
) =>
  render(
    <Provider store={store()}>
      <UpcomingSessionModal
        kind="seminar"
        status="booked"
        role={role}
        onClose={vi.fn()}
        sessions={sessions}
      />
    </Provider>,
  );

const recurring = (over: Partial<NonNullable<UpcomingModalSession['recurrence']>> = {}) =>
  session({
    recurrence: {
      cadence: 'Repeats weekly',
      sessionsLabel: '12 sessions',
      nextWhen: 'Thu, Oct 8, 6:00 PM',
      range: 'Oct 1 – Dec 26',
      ...over,
    },
  });

const infoButton = () => screen.getByRole('button', { name: 'Recurring seminar schedule' });

describe('recurring seminar info on a session row', () => {
  it('shows no info button for an ordinary one-off seminar', () => {
    show([session()]);

    expect(
      screen.queryByRole('button', { name: 'Recurring seminar schedule' }),
    ).not.toBeInTheDocument();
  });

  it('shows one beside a row standing for a series', () => {
    show([recurring()]);

    expect(infoButton()).toBeInTheDocument();
  });

  it('explains the series on hover', () => {
    show([recurring()]);
    fireEvent.mouseEnter(infoButton());

    expect(screen.getByText('Recurring seminar')).toBeInTheDocument();
    expect(screen.getByText('Repeats weekly · 12 sessions')).toBeInTheDocument();
    expect(screen.getByText('Next session: Thu, Oct 8, 6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Runs Oct 1 – Dec 26')).toBeInTheDocument();
  });

  it('leaves out a line the booking could not supply', () => {
    show([recurring({ range: undefined, cadence: undefined })]);
    fireEvent.mouseEnter(infoButton());

    expect(screen.getByText('12 sessions')).toBeInTheDocument();
    expect(screen.queryByText(/^Runs/)).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip').querySelectorAll('p')).toHaveLength(
      1 /* heading */ + 2 /* sessions, next session */,
    );
  });

  it('still opens the session details from the title beside it', () => {
    render(
      <Provider store={store()}>
        <UpcomingSessionModal
          kind="seminar"
          status="booked"
          role="student"
          onClose={vi.fn()}
          sessions={[
            session({
              recurrence: { sessionsLabel: '12 sessions', range: 'Oct 1 – Dec 26' },
              detail: {
                title: 'Intro to Quantum Computing',
                admin: { _id: 'u1', username: 'Dr. Rivera', email: 'rivera@example.com' },
                participants: [],
              },
            }),
          ]}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Intro to Quantum Computing' }));

    expect(screen.getByText('rivera@example.com')).toBeInTheDocument();
  });

  it('keeps the row date visible alongside the series info', () => {
    show([recurring()]);

    expect(screen.getAllByText('Thu, Oct 8, 6:00 PM').length).toBeGreaterThan(0);
  });

  it('shows it to the hosting expert too, not only the student', () => {
    show([recurring()], 'expert');
    fireEvent.mouseEnter(infoButton());

    expect(screen.getByText('Recurring seminar')).toBeInTheDocument();
    expect(screen.getByText('Repeats weekly \u00b7 12 sessions')).toBeInTheDocument();
    expect(screen.getByText('Next session: Thu, Oct 8, 6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Runs Oct 1 \u2013 Dec 26')).toBeInTheDocument();
  });

  it('leaves a one-off seminar unmarked for the expert as well', () => {
    show([session()], 'expert');

    expect(
      screen.queryByRole('button', { name: 'Recurring seminar schedule' }),
    ).not.toBeInTheDocument();
  });

  it('shows one info button per series when several are listed', () => {
    show([
      recurring(),
      session({ id: 'seminar-2', title: 'Second seminar' }),
      session({
        id: 'seminar-3',
        title: 'Third seminar',
        recurrence: { sessionsLabel: '4 sessions', range: 'Nov 2 – Nov 23' },
      }),
    ]);

    expect(screen.getAllByRole('button', { name: 'Recurring seminar schedule' })).toHaveLength(2);
  });
});
