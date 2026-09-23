import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../api/api', () => ({
  getUserFeedbacks: vi.fn(),
  getAllFeedbacks: vi.fn(),
  doFilterUsers: vi.fn(async () => ({ result: [] })),
}));

import Feedback from './getFeedback';
import { getAllFeedbacks } from '../api/api';

const row = (over: Record<string, any> = {}) => ({
  rating: 1,
  description: 'TEST-FEEDBACK2',
  date: '2026-09-15T21:46:43.000Z',
  otherUser: {
    _id: 'u2',
    username: 'Expert Two',
    email: 'purnavasanth02@gmail.com',
    role: 'expert',
  },
  userUsername: 'Purna Vasanth Repalle',
  userEmail: 'purnavasanth01@gmail.com',
  userRole: 'customer',
  ...over,
});

const renderWith = async (rows: any[]) => {
  (getAllFeedbacks as any).mockResolvedValue({ result: rows, totalCount: rows.length });
  render(<Feedback />);
  await waitFor(() => expect(getAllFeedbacks).toHaveBeenCalled());
};

describe('admin feedback card', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the seminar name, author and recipient in the agreed order', async () => {
    await renderWith([
      row({ meetingKind: 'seminar', meetingName: 'Intro to Quantum Computing' }),
    ]);

    const card = await screen.findByText('Seminar: Intro to Quantum Computing');
    const text = card.closest('div')!.textContent!;

    expect(text).toContain('Given by: purnavasanth02@gmail.com (expert)');
    expect(text).toContain('Given to: purnavasanth01@gmail.com (customer)');
    expect(text).toContain('Rating: 1');
    expect(text).toContain('Feedback: TEST-FEEDBACK2');

    expect(text.indexOf('Given by')).toBeLessThan(text.indexOf('Given to'));
    expect(text.indexOf('Given to')).toBeLessThan(text.indexOf('Rating'));
    expect(text.indexOf('Rating')).toBeLessThan(text.indexOf('Feedback'));
    expect(text.indexOf('Feedback')).toBeLessThan(text.indexOf('Date'));
  });

  it('labels a 1:1 without inventing a session name', async () => {
    await renderWith([row({ meetingKind: 'individual', meetingName: null })]);
    expect(await screen.findByText('1:1 Appointment')).toBeTruthy();
  });

  it('distinguishes a community call from a seminar', async () => {
    await renderWith([
      row({ meetingKind: 'community', meetingName: 'Physics Community' }),
    ]);
    expect(await screen.findByText('Community: Physics Community')).toBeTruthy();
  });

  it('no longer renders the misleading From/Counterpart labels', async () => {
    await renderWith([row({ meetingKind: 'seminar', meetingName: 'S' })]);
    await screen.findByText('Seminar: S');
    expect(screen.queryByText(/Counterpart:/)).toBeNull();
    expect(screen.queryByText(/^From:/)).toBeNull();
  });

  it('falls back to legacy eventType when meetingKind is absent', async () => {
    await renderWith([
      row({ eventType: 'seminar', groupChat: { _id: 'g1', name: 'Legacy Seminar' } }),
    ]);
    expect(await screen.findByText('Seminar: Legacy Seminar')).toBeTruthy();
  });

  it('degrades to a neutral heading rather than crashing on an unknown kind', async () => {
    await renderWith([row({ meetingKind: 'unknown', meetingName: null })]);
    expect(await screen.findByText('Session')).toBeTruthy();
  });
});
