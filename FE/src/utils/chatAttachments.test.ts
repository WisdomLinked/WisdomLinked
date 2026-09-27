import { describe, expect, it } from 'vitest';
import {
  isAllowedChatFileName,
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
