import { decodeRichHtmlWire, isRichHtmlWire } from './chatRichHtmlWire';
import { decodeBasicEntities, peelWireFormatReply, stripHtmlTags } from './chatReplyLayout';
import { isInlineImageAttachment } from './chatAttachments';

export const CHAT_PREVIEW_MAX_LENGTH = 120;

const FILE_PREFIX = 'Chatfile: ';
const previewFileAttachment = (raw: string): string => {
    const payload = raw.slice(FILE_PREFIX.length);
    const [url, name] = payload.split('#####');
    const label = String(name || '').trim();
    if (isInlineImageAttachment(label || url)) return label ? `Photo · ${label}` : 'Photo';
    return label || 'Attachment';
};

const previewMeetingMarker = (raw: string): string | null => {
    if (raw.startsWith('__MEETING_STARTED__::')) return 'Video call started';
    if (raw.startsWith('__MEETING_ENDED__::')) return 'Video call ended';
    if (raw.startsWith('__MEETING_CHAT__::')) return 'Message from a video call';
    // Any other internal marker is unknown to this build; show nothing rather than leak it.
    if (raw.startsWith('__') && raw.includes('::')) return '';
    return null;
};

const collapse = (value: string): string => String(value ?? '').replace(/\s+/g, ' ').trim();

const truncate = (value: string, max: number): string =>
    value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

export const chatMessagePreview = (
    content: unknown,
    options: { maxLength?: number } = {},
): string => {
    const max = options.maxLength ?? CHAT_PREVIEW_MAX_LENGTH;
    const raw = String(content ?? '').trim();
    if (!raw) return '';

    if (raw.startsWith(FILE_PREFIX)) return truncate(collapse(previewFileAttachment(raw)), max);

    const meeting = previewMeetingMarker(raw);
    if (meeting !== null) return truncate(collapse(meeting), max);

    const reply = peelWireFormatReply(raw);
    if (reply) {
        const body = chatMessagePreview(reply.bodyHtml, options);
        return body || 'Reply';
    }

    if (isRichHtmlWire(raw)) {
        const html = decodeRichHtmlWire(raw);
        if (html) return truncate(collapse(decodeBasicEntities(stripHtmlTags(html))), max);
    }

    return truncate(collapse(decodeBasicEntities(stripHtmlTags(raw))), max);
};

export const chatRowPreviewLine = (
    content: unknown,
    options: { fromMe?: boolean; fallback?: string; maxLength?: number } = {},
): string => {
    const preview = chatMessagePreview(content, { maxLength: options.maxLength });
    if (!preview) return options.fallback ?? '';
    return options.fromMe ? `You: ${preview}` : preview;
};
