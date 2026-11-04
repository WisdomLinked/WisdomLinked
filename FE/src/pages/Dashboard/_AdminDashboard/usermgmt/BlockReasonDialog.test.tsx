import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({ doGetUserBlockReason: vi.fn() }));

import { doGetUserBlockReason } from '../../../../api/api';
import BlockReasonDialog from './BlockReasonDialog';

const mockedReason = vi.mocked(doGetUserBlockReason);

const pressBackdrop = () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
  const dialog = screen.getByRole('dialog');
  fireEvent.mouseDown(dialog);
  fireEvent.click(dialog);
  clock.mockRestore();
};

const setup = () => {
  const onClose = vi.fn();
  const view = render(<BlockReasonDialog user={{ _id: 'u1', email: 'ann@x.com', username: 'ann' }} onClose={onClose} />);
  return { actor: userEvent.setup(), onClose, ...view };
};

describe('BlockReasonDialog', () => {
  beforeEach(() => {
    mockedReason.mockReset();
  });

  it('asks for this user\'s reason once, and shows it with their email', async () => {
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: 'Spamming students' } as any);
    setup();
    expect(screen.getByRole('dialog', { name: 'Reason for blocking this user' })).toBeInTheDocument();
    expect(screen.getByText('ann@x.com')).toBeInTheDocument();
    expect(await screen.findByText('Spamming students')).toBeInTheDocument();
    expect(mockedReason).toHaveBeenCalledTimes(1);
    expect(mockedReason).toHaveBeenCalledWith('u1');
  });

  it('shows Loading until the answer arrives', async () => {
    let answer: (value: any) => void = () => undefined;
    mockedReason.mockReturnValue(new Promise(resolve => { answer = resolve; }) as any);
    setup();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(async () => answer({ status: 'SUCCESS', reason: 'Spam' }));
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('Spam')).toBeInTheDocument();
  });

  it('keeps its title and Close fixed while a long reason scrolls', () => {
    mockedReason.mockReturnValue(new Promise(() => undefined) as any);
    setup();
    expect(screen.getByText('Loading…').parentElement).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(screen.getByRole('heading')).toHaveClass('shrink-0');
    expect(screen.getByRole('button', { name: 'Close' }).parentElement).toHaveClass('shrink-0');
  });

  it('keeps line breaks and long words inside the small box', async () => {
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: 'line one\nline two' } as any);
    setup();
    const text = await screen.findByText(/line one/);
    expect(text.textContent).toBe('line one\nline two');
    expect(text).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(screen.getByRole('dialog').firstElementChild).toHaveClass('max-w-sm');
  });

  it('shows HTML in a reason as plain text', async () => {
    const html = '<img src=x onerror="window.__xss=1">';
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: html } as any);
    setup();
    expect(await screen.findByText(html)).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('img')).toBeNull();
  });

  it.each([null, undefined, ''])('says no reason was recorded when the reason is %j', async reason => {
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason } as any);
    setup();
    expect(await screen.findByText('No reason was recorded for this block.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([[false], [{ status: 'FAIL' }]])('says so when the reason cannot be loaded (%j)', async answer => {
    mockedReason.mockResolvedValue(answer as any);
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the reason. Please try again.');
    expect(screen.queryByText('No reason was recorded for this block.')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('Close, Escape and a click outside all close it; Close starts focused', async () => {
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: 'Spam' } as any);
    const { actor, onClose } = setup();
    await screen.findByText('Spam');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await actor.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await actor.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
    pressBackdrop();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('a click inside the box does not close it', async () => {
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: 'Spam' } as any);
    const { actor, onClose } = setup();
    await actor.click(await screen.findByText('Spam'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an answer arriving after it closed changes nothing', async () => {
    let answer: (value: any) => void = () => undefined;
    mockedReason.mockReturnValue(new Promise(resolve => { answer = resolve; }) as any);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = setup();
    unmount();
    await act(async () => answer({ status: 'SUCCESS', reason: 'Late' }));
    expect(screen.queryByText('Late')).toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
