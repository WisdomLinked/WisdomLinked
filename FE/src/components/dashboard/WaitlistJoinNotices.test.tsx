import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WaitlistJoinNotices from './WaitlistJoinNotices';
import type { WaitlistJoinNotice } from '../../utils/seminarWaitlist';

const notice = (over: Partial<WaitlistJoinNotice> = {}): WaitlistJoinNotice => ({
  seminarId: 'sem-1',
  title: 'Calculus',
  start: '2026-12-01T10:00:00Z',
  names: ['Ana'],
  latestJoinAt: new Date().toISOString(),
  waiting: 3,
  seats: { occupied: 5, maxAttendees: 5 },
  ...over,
});

describe('WaitlistJoinNotices', () => {
  it('says who joined, the seat count and when it clears', () => {
    render(<WaitlistJoinNotices notices={[notice()]} onOpenWaitlist={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Ana joined the waitlist for “Calculus”.')).toBeInTheDocument();
    expect(screen.getByText(/2026.*· Seats taken: 5 of 5 · 3 waiting/)).toBeInTheDocument();
    expect(screen.getByText(/Also sent to your email · this message clears in 48h/)).toBeInTheDocument();
  });

  it('opens the waitlist and dismisses the right seminar', async () => {
    const onOpenWaitlist = vi.fn();
    const onDismiss = vi.fn();
    const second = notice({ seminarId: 'sem-2', title: 'Biology', start: null });
    render(
      <WaitlistJoinNotices
        notices={[notice(), second]}
        onOpenWaitlist={onOpenWaitlist}
        onDismiss={onDismiss}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Open waitlist' })[0]);
    expect(onOpenWaitlist).toHaveBeenCalledWith(expect.objectContaining({ seminarId: 'sem-1' }));
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Dismiss the waitlist message for Biology' }));
    expect(onDismiss).toHaveBeenCalledWith(second);
  });

  it('tells two dates of the same seminar apart', () => {
    render(
      <WaitlistJoinNotices
        notices={[
          notice({ seminarId: 'd1', start: '2026-12-01T10:00:00Z' }),
          notice({ seminarId: 'd2', start: '2026-12-08T10:00:00Z' }),
        ]}
        onOpenWaitlist={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole('button', { name: /^Dismiss/ }).map(b => b.getAttribute('aria-label'));
    expect(new Set(labels).size).toBe(2);
  });

  it('shows three seminars until asked for the rest', async () => {
    const many = Array.from({ length: 5 }, (_, i) => notice({ seminarId: `s${i}`, title: `S${i}` }));
    render(<WaitlistJoinNotices notices={many} onOpenWaitlist={vi.fn()} onDismiss={vi.fn()} />);
    const user = userEvent.setup();
    expect(screen.getAllByRole('button', { name: 'Open waitlist' })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Show 2 more seminars' }));
    expect(screen.getAllByRole('button', { name: 'Open waitlist' })).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('button', { name: 'Open waitlist' })).toHaveLength(3);
  });

  it('has no show-more button at three or fewer', () => {
    const three = Array.from({ length: 3 }, (_, i) => notice({ seminarId: `s${i}`, title: `S${i}` }));
    render(<WaitlistJoinNotices notices={three} onOpenWaitlist={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /more seminar/ })).not.toBeInTheDocument();
  });

  it('shows nothing when there is nothing new', () => {
    const { container } = render(
      <WaitlistJoinNotices notices={[]} onOpenWaitlist={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
