import { describe, expect, it } from 'vitest';
import { chatMessagePreview, chatRowPreviewLine } from './chatMessagePreview';

const richWire = (html: string) => `__WL_HTML__|${encodeURIComponent(html)}`;

describe('chatMessagePreview', () => {
    it('returns an empty string for empty or missing content', () => {
        expect(chatMessagePreview('')).toBe('');
        expect(chatMessagePreview('   ')).toBe('');
        expect(chatMessagePreview(null)).toBe('');
        expect(chatMessagePreview(undefined)).toBe('');
    });

    it('passes plain text straight through', () => {
        expect(chatMessagePreview('see you at 4')).toBe('see you at 4');
    });

    it('strips paragraph markup from composer HTML', () => {
        expect(chatMessagePreview('<p>see you at 4</p>')).toBe('see you at 4');
    });

    it('decodes HTML entities rather than showing them raw', () => {
        expect(chatMessagePreview('<p>Tom &amp; Jerry said &quot;hi&quot;</p>')).toBe('Tom & Jerry said "hi"');
    });

    it('collapses newlines and runs of whitespace into one line', () => {
        expect(chatMessagePreview('<p>line one</p><p>line two</p>')).toBe('line one line two');
        expect(chatMessagePreview('a\n\n   b')).toBe('a b');
    });

    it('decodes the rich-HTML wire format', () => {
        expect(chatMessagePreview(richWire('<p><strong>bold</strong> and <em>italic</em></p>')))
            .toBe('bold and italic');
    });

    it('falls back to stripping when a rich-HTML payload is malformed', () => {
        // A truncated percent-escape cannot be decoded; it must not throw.
        expect(() => chatMessagePreview('__WL_HTML__|%E0%A4%A')).not.toThrow();
    });

    it('previews a reply with the body, not the quoted message', () => {
        const wire = '__WL_REPLY__|abc123|Priya|the%20original%20question|\nhere is my answer';
        expect(chatMessagePreview(wire)).toBe('here is my answer');
    });

    it('labels a reply with no body rather than returning nothing', () => {
        expect(chatMessagePreview('__WL_REPLY__|abc123|Priya|quoted|\n')).toBe('Reply');
    });

    it('describes an image attachment as a photo, not a URL', () => {
        const wire = 'Chatfile: https://x.digitaloceanspaces.com/chatFiles/1_shot.png#####shot.png';
        expect(chatMessagePreview(wire)).toBe('Photo · shot.png');
        expect(chatMessagePreview(wire)).not.toContain('https://');
    });

    it('describes a non-image attachment by filename', () => {
        const wire = 'Chatfile: https://x.digitaloceanspaces.com/chatFiles/1_report.pdf#####report.pdf';
        expect(chatMessagePreview(wire)).toBe('report.pdf');
    });

    it('falls back to a generic label when an attachment has no filename', () => {
        expect(chatMessagePreview('Chatfile: https://x.digitaloceanspaces.com/f/a.pdf#####')).toBe('Attachment');
        expect(chatMessagePreview('Chatfile: https://x.digitaloceanspaces.com/f/a.png#####')).toBe('Photo');
    });

    it('labels meeting markers instead of leaking the sentinel', () => {
        expect(chatMessagePreview('__MEETING_STARTED__::room1')).toBe('Video call started');
        expect(chatMessagePreview('__MEETING_ENDED__::room1')).toBe('Video call ended');
        expect(chatMessagePreview('__MEETING_CHAT__::alice::hello')).toBe('Message from a video call');
    });

    it('shows nothing for an unrecognised internal marker', () => {
        expect(chatMessagePreview('__SOMETHING_NEW__::payload')).toBe('');
    });

    it('truncates long messages with an ellipsis', () => {
        const out = chatMessagePreview('x'.repeat(400));
        expect(out).toHaveLength(120);
        expect(out.endsWith('…')).toBe(true);
    });

    it('respects a custom maxLength', () => {
        expect(chatMessagePreview('abcdefghij', { maxLength: 5 })).toBe('abcd…');
    });

    it('does not truncate a message that exactly fits', () => {
        const exact = 'y'.repeat(120);
        expect(chatMessagePreview(exact)).toBe(exact);
    });
});

describe('chatRowPreviewLine', () => {
    it('prefixes your own message with "You:"', () => {
        expect(chatRowPreviewLine('<p>on my way</p>', { fromMe: true })).toBe('You: on my way');
    });

    it('does not prefix a message from the other person', () => {
        expect(chatRowPreviewLine('<p>on my way</p>', { fromMe: false })).toBe('on my way');
    });

    it('uses the fallback when there is no preview to show', () => {
        expect(chatRowPreviewLine('', { fallback: 'Direct message' })).toBe('Direct message');
        expect(chatRowPreviewLine('__SOMETHING_NEW__::x', { fallback: 'Direct message' })).toBe('Direct message');
    });

    it('does not prefix the fallback with "You:"', () => {
        expect(chatRowPreviewLine('', { fromMe: true, fallback: 'Direct message' })).toBe('Direct message');
    });

    it('prefixes your own attachment too', () => {
        const wire = 'Chatfile: https://x.digitaloceanspaces.com/f/1_a.png#####a.png';
        expect(chatRowPreviewLine(wire, { fromMe: true })).toBe('You: Photo · a.png');
    });
});
