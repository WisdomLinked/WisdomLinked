import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessageComposer from './MessageComposer';

vi.mock('@emoji-mart/data', () => ({ default: {} }));
vi.mock('@emoji-mart/react', () => ({ default: () => null }));

describe('MessageComposer', () => {
  it('disables send when empty', () => {
    render(<MessageComposer onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('sends text on Enter and clears the field', async () => {
    const onSend = vi.fn(async () => undefined);
    render(<MessageComposer onSend={onSend} />);
    const input = screen.getByLabelText('Message') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'hello there' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ text: 'hello there', attachments: [] }));
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'line' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('rejects oversized files with an inline chip error', () => {
    render(<MessageComposer onSend={vi.fn()} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [big] } });
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
