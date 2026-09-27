import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessageComposer, { sanitizeComposerHtml } from './MessageComposer';
import { normalizeLinkUrl } from './LinkPopover';

vi.mock('@emoji-mart/data', () => ({ default: {} }));
vi.mock('@emoji-mart/react', () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (e: { native: string }) => void }) => (
    <button type="button" onClick={() => onEmojiSelect({ native: '😀' })}>
      pick smile
    </button>
  ),
}));

beforeAll(() => {
  // ProseMirror measures layout, which jsdom does not implement.
  const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) };
  const rectList = Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => rectList;
  Element.prototype.getClientRects = () => rectList;
  if (!document.elementFromPoint) document.elementFromPoint = () => null;
});

const editorEl = () => screen.getByRole('textbox', { name: 'Message' });
const sendBtn = () => screen.getByRole('button', { name: 'Send message' });

async function insertEmoji() {
  fireEvent.click(screen.getByRole('button', { name: 'Add emoji' }));
  fireEvent.click(await screen.findByText('pick smile'));
}

describe('MessageComposer', () => {
  it('starts with send disabled and the toolbar always visible', () => {
    render(<MessageComposer onSend={vi.fn()} />);
    expect(sendBtn()).toBeDisabled();
    expect(screen.getByRole('toolbar', { name: 'Text formatting' })).toBeInTheDocument();
  });

  it('shows format buttons with aria-pressed state', async () => {
    render(<MessageComposer onSend={vi.fn()} />);
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bold);
    await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'));
    for (const name of ['Italic', 'Underline', 'Strikethrough', 'Numbered list', 'Bulleted list', 'Link']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('type', 'button');
    }
  });

  it('inserts an emoji and sends html + text, then clears', async () => {
    const onSend = vi.fn(async () => undefined);
    render(<MessageComposer onSend={onSend} />);
    await insertEmoji();
    await waitFor(() => expect(sendBtn()).toBeEnabled());
    fireEvent.click(sendBtn());
    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({ html: '<p>😀</p>', text: '😀', attachments: [] }),
    );
    await waitFor(() => expect(editorEl().textContent).toBe(''));
    expect(sendBtn()).toBeDisabled();
  });

  it('sends on Enter and blocks double sends while pending', async () => {
    let resolve!: () => void;
    const onSend = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<MessageComposer onSend={onSend} />);
    await insertEmoji();
    fireEvent.keyDown(editorEl(), { key: 'Enter' });
    fireEvent.keyDown(editorEl(), { key: 'Enter' });
    fireEvent.click(sendBtn());
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(sendBtn()).toHaveAttribute('aria-busy', 'true');
    await act(async () => resolve());
    await waitFor(() => expect(sendBtn()).toHaveAttribute('aria-busy', 'false'));
  });

  it('keeps the content when sending fails', async () => {
    const onSend = vi.fn(async () => {
      throw new Error('nope');
    });
    render(<MessageComposer onSend={onSend} />);
    await insertEmoji();
    fireEvent.click(sendBtn());
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    await waitFor(() => expect(sendBtn()).toBeEnabled());
    expect(editorEl().textContent).toBe('😀');
  });

  it('attaches files as removable chips and rejects oversized ones inline', async () => {
    render(<MessageComposer onSend={vi.fn()} maxFileSizeMB={1} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const ok = new File(['hi'], 'notes.pdf', { type: 'application/pdf' });
    const big = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 2 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [ok, big] } });

    expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/huge\.pdf.*over the 1 MB limit/);
    expect(sendBtn()).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.pdf' }));
    expect(screen.queryByText('notes.pdf')).toBeNull();
    expect(sendBtn()).toBeDisabled();
  });

  it('limits the number of files', () => {
    render(<MessageComposer onSend={vi.fn()} maxFiles={1} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')] },
    });
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/only 1 files per message/);
  });

  it('opens the link popover and closes it on Escape', async () => {
    render(<MessageComposer onSend={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByRole('dialog', { name: 'Insert link' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Insert link' })).toBeNull());
  });

  it('inserts a link from the popover', async () => {
    const onSend = vi.fn(async () => undefined);
    render(<MessageComposer onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(sendBtn()).toBeEnabled());
    fireEvent.click(sendBtn());
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    const html = (onSend.mock.calls[0] as unknown as [{ html: string }])[0].html;
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('restores controlled draft content without echoing onChange', async () => {
    const onChange = vi.fn();
    render(<MessageComposer onSend={vi.fn()} value="<p>draft <strong>text</strong></p>" onChange={onChange} />);
    await waitFor(() => expect(editorEl().innerHTML).toContain('<strong>text</strong>'));
    expect(onChange).not.toHaveBeenCalled();
    expect(sendBtn()).toBeEnabled();
  });
});

describe('composer helpers', () => {
  it('sanitizes outgoing html to chat-safe tags and trims empty paragraphs', () => {
    expect(
      sanitizeComposerHtml('<p></p><p>hi <img src=x onerror=alert(1)><script>x</script><strong>b</strong></p><p></p>'),
    ).toBe('<p>hi <strong>b</strong></p>');
    expect(sanitizeComposerHtml('<p><a href="javascript:alert(1)">x</a></p>')).toBe('<p><a>x</a></p>');
  });

  it('normalizes link urls', () => {
    expect(normalizeLinkUrl('example.com')).toBe('https://example.com');
    expect(normalizeLinkUrl('http://a.io/x')).toBe('http://a.io/x');
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('not a link')).toBeNull();
  });
});
