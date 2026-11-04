import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlockUserDialog from './BlockUserDialog';

const setup = (onConfirm: any = vi.fn(async () => 'blocked')) => {
  const onCancel = vi.fn();
  render(<BlockUserDialog user={{ email: 'ann@x.com', username: 'ann' }} onCancel={onCancel} onConfirm={onConfirm} />);
  return { actor: userEvent.setup(), onCancel, onConfirm };
};

const reasonBox = () => screen.getByRole('textbox');
const blockButton = () => screen.getByRole('button', { name: 'Block user' });

const pressBackdrop = () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
  const dialog = screen.getByRole('dialog');
  fireEvent.mouseDown(dialog);
  fireEvent.click(dialog);
  clock.mockRestore();
};

describe('BlockUserDialog', () => {
  it('asks for the reason, names the user, and starts in the text box', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Please state the reason for blocking this user' })).toBeInTheDocument();
    expect(screen.getByText('ann@x.com')).toBeInTheDocument();
    expect(reasonBox()).toHaveFocus();
  });

  it('is small and uses a red that exists in this project', () => {
    setup();
    expect(screen.getByRole('dialog').firstElementChild).toHaveClass('max-w-sm');
    expect(blockButton()).toHaveClass('bg-red');
    expect(blockButton().className).not.toMatch(/bg-red-\d/);
  });

  it.each(['', '    ', '\n\n', '\u200b\u200b', '\u00a0', '\u200f\u200d'])('cannot block with the blank reason %j', async text => {
    const { onConfirm } = setup();
    fireEvent.change(reasonBox(), { target: { value: text } });
    expect(blockButton()).toBeDisabled();
    fireEvent.click(blockButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('an emoji joined with an invisible character still counts as a reason', () => {
    setup();
    fireEvent.change(reasonBox(), { target: { value: '\u200d🚫' } });
    expect(blockButton()).not.toBeDisabled();
  });

  it('says so when the user was already blocked, and offers only Close', async () => {
    const onConfirm = vi.fn(async () => 'alreadyBlocked');
    const { actor, onCancel } = setup(onConfirm);
    await actor.type(reasonBox(), 'Second reason');
    await actor.click(blockButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('already blocked, so this reason was not saved');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Could not block');
    expect(blockButton()).toBeDisabled();
    expect(reasonBox()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await actor.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('sends the reason without its surrounding spaces', async () => {
    const { actor, onConfirm } = setup();
    await actor.type(reasonBox(), '  Spamming students ');
    await actor.click(blockButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Spamming students');
  });

  it('limits the reason to 500 characters', () => {
    setup();
    expect(reasonBox()).toHaveAttribute('maxLength', '500');
  });

  it('Cancel, Escape and a click outside all close it without blocking', async () => {
    const { actor, onCancel, onConfirm } = setup();
    await actor.type(reasonBox(), 'Spam');
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await actor.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
    pressBackdrop();
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a click inside the box does not close it', async () => {
    const { actor, onCancel } = setup();
    await actor.click(screen.getByText('ann@x.com'));
    await actor.click(reasonBox());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps the typed reason and says so when blocking fails, and can try again', async () => {
    const onConfirm = vi.fn(async () => 'failed');
    const { actor } = setup(onConfirm);
    await actor.type(reasonBox(), 'Spam');
    await actor.click(blockButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not block this user. Please try again.');
    expect(reasonBox()).toHaveValue('Spam');
    await waitFor(() => expect(blockButton()).not.toBeDisabled());
    await actor.click(blockButton());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('cannot be sent twice or cancelled while saving', async () => {
    let finish: (result: string) => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const { actor, onCancel } = setup(onConfirm);
    await actor.type(reasonBox(), 'Spam');
    await actor.click(blockButton());
    expect(blockButton()).toBeDisabled();
    fireEvent.click(blockButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    pressBackdrop();
    fireEvent.keyDown(reasonBox(), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    finish('blocked');
  });
});
