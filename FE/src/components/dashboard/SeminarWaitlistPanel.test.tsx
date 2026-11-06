import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeminarWaitlistPanel from './SeminarWaitlistPanel';
import type { WaitlistSeminar } from '../../utils/seminarWaitlist';

const seminar = (over: Partial<WaitlistSeminar> = {}): WaitlistSeminar => ({
  seminarId: 'sem-1',
  title: 'Calculus',
  start: '2026-12-01T10:00:00Z',
  recurring: false,
  seats: { occupied: 50, maxAttendees: 50 },
  students: [
    { requestId: 'r1', userId: 'u1', name: 'First Student', joinedAt: '2026-11-01T10:00:00Z' },
    { requestId: 'r2', userId: 'u2', name: 'Second Student', joinedAt: '2026-11-02T10:00:00Z' },
    { requestId: 'r3', userId: 'u3', name: 'Third Student', joinedAt: '2026-11-03T10:00:00Z' },
  ],
  ...over,
});

const setup = (props: Partial<Parameters<typeof SeminarWaitlistPanel>[0]> = {}) => {
  const onAdmit = vi.fn(async () => ({ message: 'Done.' })) as any;
  const onViewStudent = vi.fn();
  render(
    <SeminarWaitlistPanel
      seminars={[seminar()]}
      showEmptyMessage
      onAdmit={onAdmit}
      onViewStudent={onViewStudent}
      {...props}
    />,
  );
  return { onAdmit, onViewStudent, user: userEvent.setup() };
};

const numberBox = () => screen.getByLabelText('Number of students to admit to Calculus');

describe('SeminarWaitlistPanel', () => {
  it('lists students in join order with the seat count', () => {
    setup();
    const names = within(screen.getByRole('list')).getAllByRole('button').map(b => b.textContent);
    expect(names).toEqual(['First Student', 'Second Student', 'Third Student']);
    expect(screen.getByText(/Seats taken: 50 of 50 · 3 waiting/)).toBeInTheDocument();
  });

  it('opens a student profile from their name', async () => {
    const { onViewStudent, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Second Student' }));
    expect(onViewStudent).toHaveBeenCalledWith('u2', 'Second Student');
  });

  it('asks before admitting a number, showing the new limit', async () => {
    const { onAdmit, user } = setup();
    await user.type(numberBox(), '2');
    await user.click(screen.getByRole('button', { name: 'Admit' }));
    expect(onAdmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Admit 2 students from the waitlist? Max attendees goes from 50 to 52.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAdmit).toHaveBeenCalledWith(expect.objectContaining({ seminarId: 'sem-1' }), { count: 2 });
    expect(await screen.findByRole('status')).toHaveTextContent('Done.');
  });

  it('limits a number above the waitlist size', async () => {
    const { onAdmit, user } = setup();
    await user.type(numberBox(), '99');
    await user.click(screen.getByRole('button', { name: 'Admit' }));
    expect(
      screen.getByText('Admit 3 students from the waitlist? Max attendees goes from 50 to 53.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAdmit).toHaveBeenCalledWith(expect.anything(), { count: 3 });
  });

  it('admits everyone with All', async () => {
    const { onAdmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(
      screen.getByText('Admit 3 students from the waitlist? Max attendees goes from 50 to 53.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAdmit).toHaveBeenCalledWith(expect.anything(), { all: true, expectedCount: 3 });
  });

  it.each(['', '0', 'abc'])('refuses %j without asking to confirm', async input => {
    const { onAdmit, user } = setup();
    if (input) await user.type(numberBox(), input);
    await user.click(screen.getByRole('button', { name: 'Admit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter how many students to admit.');
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(onAdmit).not.toHaveBeenCalled();
  });

  it('Cancel goes back without admitting', async () => {
    const { onAdmit, user } = setup();
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAdmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('shows the server refusal on the seminar and keeps the typed number', async () => {
    const onAdmit = vi.fn(async () => ({ error: 'This seminar is no longer open.' })) as any;
    const { user } = setup({ onAdmit });
    await user.type(numberBox(), '2');
    await user.click(screen.getByRole('button', { name: 'Admit' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This seminar is no longer open.');
    expect(numberBox()).toHaveValue('2');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains a refusal even when the seminar then leaves the list', async () => {
    const onAdmit = vi.fn(async () => ({ error: 'This seminar is no longer open.' })) as any;
    const { rerender } = render(
      <SeminarWaitlistPanel seminars={[seminar()]} showEmptyMessage={false} onAdmit={onAdmit} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findAllByRole('alert');
    rerender(<SeminarWaitlistPanel seminars={[]} showEmptyMessage={false} onAdmit={onAdmit} />);
    expect(screen.getByRole('alert')).toHaveTextContent('“Calculus”: This seminar is no longer open.');
  });

  it('drops an earlier refusal once a retry succeeds', async () => {
    const onAdmit = vi
      .fn()
      .mockResolvedValueOnce({ error: 'The waitlist has changed.' })
      .mockResolvedValueOnce({ message: 'Done.' });
    const { rerender } = render(
      <SeminarWaitlistPanel seminars={[seminar()]} showEmptyMessage={false} onAdmit={onAdmit} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByRole('status');
    rerender(<SeminarWaitlistPanel seminars={[]} showEmptyMessage={false} onAdmit={onAdmit} />);
    expect(screen.getByRole('status')).toHaveTextContent('Done.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('brings only the requested seminar into view', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scroll(this: Element, ...args: any[]) {
      scrollIntoView(this.getAttribute('aria-label'), ...args);
    } as any;
    try {
      render(
        <SeminarWaitlistPanel
          seminars={[seminar(), seminar({ seminarId: 'sem-2', title: 'Biology' })]}
          showEmptyMessage={false}
          focusSeminarId="sem-2"
          onAdmit={vi.fn() as any}
        />,
      );
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.calls[0][0]).toBe('Waitlist for Biology');
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('mentions future dates only for a recurring seminar', async () => {
    const { user } = setup({ seminars: [seminar({ recurring: true })] });
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText(/also rises on future dates/)).toBeInTheDocument();
  });

  it('shows an empty message only when asked to', () => {
    const { unmount } = render(
      <SeminarWaitlistPanel seminars={[]} showEmptyMessage onAdmit={vi.fn() as any} />,
    );
    expect(screen.getByText('No students are on a waitlist right now.')).toBeInTheDocument();
    unmount();
    render(<SeminarWaitlistPanel seminars={[]} showEmptyMessage={false} onAdmit={vi.fn() as any} />);
    expect(screen.queryByText('No students are on a waitlist right now.')).not.toBeInTheDocument();
  });
});
