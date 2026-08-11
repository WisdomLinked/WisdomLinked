import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ExpertProfile from './ExpertProfile';
import { getExpertById, getMySeatRequests } from '../../api/api';

vi.mock('../../api/api', () => ({
  getExpertById: vi.fn(),
  createGroupChatByUser: vi.fn(),
  profileImageFetch: vi.fn(async () => null),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  registerForSeminar: vi.fn(),
}));

vi.mock('./StudentExpertBookingPicker', () => ({
  default: () => <div data-testid="slot-picker" />,
}));

vi.mock('./StudentBookingCheckout', () => ({
  default: () => <div data-testid="student-checkout" />,
}));

const mentor = {
  id: 'expert-1',
  name: 'Dr. Smith',
  title: 'Professor',
  institution: 'University',
  field: 'CS',
  experience: '10',
  services: ['1-on-1'],
  image: null,
  isNew: false,
};

const FUTURE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const seminar = (overrides: any = {}) => ({
  _id: 'sem-1',
  name: 'Research Methods',
  type: 'seminar',
  status: 'active',
  start: FUTURE,
  price: 40,
  participants: ['expert-1'],
  maxAttendees: 20,
  ...overrides,
});

const storeWith = (groupChats: any[]) =>
  configureStore({
    reducer: {
      auth: () => ({
        userDetails: {
          _id: 'student-1',
          username: 'student',
          timeZone: 'UTC',
          groupChats,
        },
      }),
    },
  });

const renderProfile = (groupChats: any[]) =>
  render(
    <Provider store={storeWith(groupChats)}>
      <ExpertProfile mentor={mentor} onBack={vi.fn()} />
    </Provider>,
  );

describe('ExpertProfile seminar registration state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMySeatRequests).mockResolvedValue({ result: [] } as any);
    vi.mocked(getExpertById).mockResolvedValue({
      result: {
        _id: 'expert-1',
        timeSlots: [18],
        price: 60,
        timeZone: 'UTC',
        events: [],
        groupChats: [seminar()],
        pendingGroupChats: [],
      },
    } as any);
  });

  it('offers the seminar for booking when the student is not enrolled', async () => {
    renderProfile([]);

    expect(await screen.findByRole('button', { name: /book the session/i })).toBeTruthy();
    expect(screen.queryByText(/Registered/i)).toBeNull();
  });

  it('marks an enrolled seminar as Registered and removes the pay button', async () => {
    renderProfile([seminar()]);

    await waitFor(() => {
      expect(screen.getByText('Registered')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /book the session/i })).toBeNull();
    expect(screen.queryByText(/enrolled in this seminar/i)).toBeNull();
  });

  it('counts any booked occurrence of a recurring series as registered', async () => {
    vi.mocked(getExpertById).mockResolvedValue({
      result: {
        _id: 'expert-1',
        timeSlots: [18],
        price: 60,
        timeZone: 'UTC',
        events: [],
        groupChats: [seminar({ seriesId: 'series-1' })],
        pendingGroupChats: [],
      },
    } as any);

    // The student booked a *different* occurrence of the same series.
    renderProfile([seminar({ _id: 'sem-2', seriesId: 'series-1' })]);

    await waitFor(() => {
      expect(screen.getByText('Registered')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /book the session/i })).toBeNull();
  });

  it('shows an awaiting-approval seminar instead of offering a second hold', async () => {
    vi.mocked(getMySeatRequests).mockResolvedValue({
      result: [{ status: 'pending', groupChat: { _id: 'sem-1' } }],
    } as any);

    renderProfile([]);

    await waitFor(() => {
      expect(screen.getByText(/Awaiting approval/i)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /book the session/i })).toBeNull();
  });

  it('ignores a seat request that has already been decided', async () => {
    vi.mocked(getMySeatRequests).mockResolvedValue({
      result: [{ status: 'rejected', groupChat: { _id: 'sem-1' } }],
    } as any);

    renderProfile([]);

    expect(await screen.findByRole('button', { name: /book the session/i })).toBeTruthy();
  });
});
