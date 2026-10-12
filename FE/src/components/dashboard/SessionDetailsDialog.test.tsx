import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionDetailsDialog from './SessionDetailsDialog';

const seminarDetails = vi.fn((_props: any) => <div data-testid="seminar-details" />);
vi.mock('../../pages/Dashboard/seminarDetails', () => ({ default: (props: any) => seminarDetails(props) }));

const detail = { title: 'Weekly Dev Catchup', admin: { username: 'Khussal' }, participants: [{ username: 'Ann' }] };

describe('SessionDetailsDialog', () => {
  it('shows the label and title, and renders the shared details with the Expert label', () => {
    render(<SessionDetailsDialog title="Weekly Dev Catchup" briefLabel="Seminar details" detail={detail} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Seminar details: Weekly Dev Catchup' });
    expect(dialog).toHaveTextContent('Seminar details');
    expect(dialog).toHaveTextContent('Weekly Dev Catchup');
    expect(seminarDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...detail, theme: 'light', adminLabel: 'Expert', hideParticipants: false }),
    );
  });

  it('falls back to "Session details" and can hide participants', () => {
    render(<SessionDetailsDialog title="Essay review" detail={detail} hideParticipants onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Session details: Essay review' })).toBeInTheDocument();
    expect(seminarDetails).toHaveBeenLastCalledWith(expect.objectContaining({ hideParticipants: true }));
  });

  it('closes from the close button and the backdrop, but not from inside the panel', async () => {
    const actor = userEvent.setup();
    const onClose = vi.fn();
    render(<SessionDetailsDialog title="Essay review" detail={detail} onClose={onClose} />);
    await actor.click(screen.getByTestId('seminar-details'));
    expect(onClose).not.toHaveBeenCalled();
    await actor.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await actor.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
