import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpcomingCountdownCard, { type UpcomingSession } from './UpcomingCountdownCard';

const detail = { title: 'Weekly Dev Catchup', admin: { username: 'Khussal' }, participants: [] };

const seminar: UpcomingSession = {
  id: 's1',
  title: 'Weekly Dev Catchup',
  startAt: Date.now() + 3_600_000,
  durationMinutes: 30,
  detail,
  briefLabel: 'Seminar details',
};

const oneToOne: UpcomingSession = {
  id: 'o1',
  title: 'Essay review',
  startAt: Date.now() + 7_200_000,
  detail: { ...detail, title: 'Essay review' },
  briefLabel: 'Session details',
};

describe('UpcomingCountdownCard session details', () => {
  it('opens the details of the next seminar and the next 1:1 from their titles', async () => {
    const actor = userEvent.setup();
    const onOpenDetails = vi.fn();
    render(<UpcomingCountdownCard nextSeminar={seminar} nextOneToOne={oneToOne} onOpenDetails={onOpenDetails} />);

    await actor.click(screen.getByRole('button', { name: 'Weekly Dev Catchup' }));
    expect(onOpenDetails).toHaveBeenLastCalledWith(seminar);

    await actor.click(screen.getByRole('button', { name: 'Essay review' }));
    expect(onOpenDetails).toHaveBeenLastCalledWith(oneToOne);
  });

  it('opens a pending 1:1 too, which has no join button', async () => {
    const actor = userEvent.setup();
    const onOpenDetails = vi.fn();
    render(<UpcomingCountdownCard nextOneToOne={{ ...oneToOne, pending: true }} onOpenDetails={onOpenDetails} />);
    expect(screen.queryByRole('button', { name: 'Join chat' })).toBeNull();
    await actor.click(screen.getByRole('button', { name: 'Essay review' }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('leaves the title as plain text when there are no details to show', () => {
    const { title, startAt } = oneToOne;
    render(<UpcomingCountdownCard nextOneToOne={{ title, startAt }} onOpenDetails={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Essay review' })).toBeNull();
    expect(screen.getByText('Essay review')).toBeInTheDocument();
  });

  it('leaves the title as plain text when no handler is given', () => {
    render(<UpcomingCountdownCard nextSeminar={seminar} />);
    expect(screen.queryByRole('button', { name: 'Weekly Dev Catchup' })).toBeNull();
  });

  it('keeps the join buttons working beside a clickable title', async () => {
    const actor = userEvent.setup();
    const onJoinSeminar = vi.fn();
    const onOpenDetails = vi.fn();
    render(<UpcomingCountdownCard nextSeminar={seminar} onJoinSeminar={onJoinSeminar} onOpenDetails={onOpenDetails} />);
    await actor.click(screen.getByRole('button', { name: 'Join seminar chat' }));
    expect(onJoinSeminar).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).not.toHaveBeenCalled();
  });
});
