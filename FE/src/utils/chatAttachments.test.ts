import { describe, expect, it } from 'vitest';
import {
  isAllowedChatFileName,
  isInlineImageAttachment,
  isComposerTextEmpty,
  MAX_CHAT_FILE_SIZE_BYTES,
  plainTextToSafeMessageHtml,
} from './chatAttachments';

describe('chatAttachments', () => {
  it('allows the documented extensions', () => {
    expect(isAllowedChatFileName('a.PDF')).toBe(true);
    expect(isAllowedChatFileName('shot.webp')).toBe(true);
    expect(isAllowedChatFileName('notes.txt')).toBe(true);
  });

  it('rejects gif csv and zip', () => {
    expect(isAllowedChatFileName('a.gif')).toBe(false);
    expect(isAllowedChatFileName('a.csv')).toBe(false);
    expect(isAllowedChatFileName('a.zip')).toBe(false);
  });

  it('uses a 10 MB limit', () => {
    expect(MAX_CHAT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('escapes plain text, preserves newlines, and auto-links urls', () => {
    const html = plainTextToSafeMessageHtml('see https://example.com/x\nand <b>hi</b>');
    expect(html).toContain('<br>');
    expect(html).toContain('<a href="https://example.com/x"');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('treats whitespace as empty', () => {
    expect(isComposerTextEmpty('  \n')).toBe(true);
    expect(isComposerTextEmpty('a')).toBe(false);
  });
});

describe('isInlineImageAttachment', () => {
  it('accepts every extension the thread renders inline', () => {
    for (const name of ['shot.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.gif']) {
      expect(isInlineImageAttachment(name)).toBe(true);
    }
  });

  it('rejects documents, which keep the file chip', () => {
    for (const name of ['report.pdf', 'notes.docx', 'notes.doc', 'data.xlsx', 'deck.pptx', 'a.txt']) {
      expect(isInlineImageAttachment(name)).toBe(false);
    }
  });

  it('ignores case', () => {
    expect(isInlineImageAttachment('SHOT.PNG')).toBe(true);
    expect(isInlineImageAttachment('Report.PDF')).toBe(false);
  });

  it('reads a full URL, not just a bare name', () => {
    expect(isInlineImageAttachment('https://wl.blr1.digitaloceanspaces.com/chatFiles/1_shot.png')).toBe(true);
    expect(isInlineImageAttachment('https://wl.blr1.digitaloceanspaces.com/chatFiles/1_cv.pdf')).toBe(false);
  });

  it('strips a query string or fragment before reading the extension', () => {
    expect(isInlineImageAttachment('https://x.digitaloceanspaces.com/a/shot.png?v=2&t=9')).toBe(true);
    expect(isInlineImageAttachment('https://x.digitaloceanspaces.com/a/shot.png#top')).toBe(true);
    expect(isInlineImageAttachment('https://x.digitaloceanspaces.com/a/cv.pdf?download=1')).toBe(false);
  });

  it('uses the last extension, so a disguised name is not treated as an image', () => {
    expect(isInlineImageAttachment('photo.png.pdf')).toBe(false);
    expect(isInlineImageAttachment('report.pdf.png')).toBe(true);
  });

  it('does not mistake a dotted folder for an extension', () => {
    expect(isInlineImageAttachment('https://x.digitaloceanspaces.com/my.files/report')).toBe(false);
  });

  it('is false for empty and missing values', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(isInlineImageAttachment(value)).toBe(false);
    }
  });
});
