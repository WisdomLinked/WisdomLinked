import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const session = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 'session-1',
  title: 'Grad school strategy',
  at: Date.now() + 48 * 3600_000,
  when: 'Fri, 3:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'Dr. Rivera',
  detail: {
    title: 'Grad school strategy',
    admin: { _id: 'u1', username: 'Dr. Rivera', email: 'rivera@example.com' },
    participants: [],
  },
  ...over,
});

const store = () =>
  configureStore({ reducer: { auth: () => ({ userDetails: { _id: 'me' } }) } });

const openDetails = (role: 'student' | 'expert', over: Partial<UpcomingModalSession> = {}) => {
  render(
    <Provider store={store()}>
      <UpcomingSessionModal
        kind="oneToOne"
        status="booked"
        role={role}
        onClose={vi.fn()}
        sessions={[session(over)]}
      />
    </Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Grad school strategy' }));
};

describe('session details panel host label', () => {
  it('labels the host Expert for a student', () => {
    openDetails('student');

    expect(screen.getByText('Expert')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('labels the host Expert for an expert', () => {
    openDetails('expert');

    expect(screen.getByText('Expert')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('still shows who the host is', () => {
    openDetails('student');

    expect(screen.getByText('rivera@example.com')).toBeInTheDocument();
  });
});
