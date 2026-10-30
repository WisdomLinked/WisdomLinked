import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CommunityProfileModal from './CommunityProfileModal';

const details = (description: string) => ({ name: 'Cohort A', description, isOpenToAll: true, participants: ['a', 'b'] });

describe('community details popup', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CommunityProfileModal isOpen onClose={onClose} communityDetails={details('Short.')} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    render(<CommunityProfileModal isOpen onClose={onClose} communityDetails={details('Short.')} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps its content in a capped, scrollable area so a long description cannot push Done off-screen', () => {
    render(<CommunityProfileModal isOpen onClose={() => undefined} communityDetails={details('Long text. '.repeat(500))} />);
    const dialog = screen.getByRole('dialog');
    const scroller = screen.getByTestId('community-info-scroll');
    expect(dialog.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
    expect(scroller.className).toMatch(/overflow-y-auto/);
    expect(scroller.contains(screen.getByRole('button', { name: 'Done' }))).toBe(true);
    expect(scroller.contains(screen.getByRole('button', { name: 'Close community info' }))).toBe(false);
  });

  it('stops listening once closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(<CommunityProfileModal isOpen onClose={onClose} communityDetails={details('x')} />);
    rerender(<CommunityProfileModal isOpen={false} onClose={onClose} communityDetails={details('x')} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps its Escape to itself, so the window that opened it stays open', () => {
    const onClose = vi.fn();
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    render(<CommunityProfileModal isOpen onClose={onClose} communityDetails={details('x')} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    window.removeEventListener('keydown', outer);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});

