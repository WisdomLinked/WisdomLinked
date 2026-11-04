import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlockUserDialog from './BlockUserDialog';

const setup = (onConfirm = vi.fn(async () => true)) => {
  const onCancel = vi.fn();
  render(<BlockUserDialog user={{ email: 'ann@x.com', username: 'ann' }} onCancel={onCancel} onConfirm={onConfirm} />);
  return { actor: userEvent.setup(), onCancel, onConfirm };
};

const reasonBox = () => screen.getByRole('textbox');
const blockButton = () => screen.getByRole('button', { name: 'Block user' });

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

  it.each(['', '    ', '\n\n'])('cannot block with the blank reason %j', async text => {
    const { onConfirm } = setup();
    fireEvent.change(reasonBox(), { target: { value: text } });
    expect(blockButton()).toBeDisabled();
    fireEvent.click(blockButton());
    expect(onConfirm).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('dialog'));
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
    const onConfirm = vi.fn(async () => false);
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
    let finish: (blocked: boolean) => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const { actor, onCancel } = setup(onConfirm);
    await actor.type(reasonBox(), 'Spam');
    await actor.click(blockButton());
    expect(blockButton()).toBeDisabled();
    fireEvent.click(blockButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.keyDown(reasonBox(), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    finish(true);
  });
});
