
export const DECISION_NOTE_MAX_LENGTH = 280;

export const sanitizeDecisionNote = (note: unknown): string => {
    if (typeof note !== 'string') return '';
    const withoutTags = note
        .replace(/<[^>]*>/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    const collapsed = withoutTags
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
        .join('\n')
        .trim();
    return collapsed.slice(0, DECISION_NOTE_MAX_LENGTH).trim();
};

// Emails are assembled as HTML strings, so the sanitized note still has to be
// entity-escaped before it is interpolated, and newlines turned into breaks.
export const decisionNoteHtml = (note: string): string => {
    if (!note) return '';
    const escaped = note
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    return escaped.replace(/\n/g, '<br />');
};

// The block appended to every decision email that carries a note.
export const decisionNoteEmailBlock = (note: string, heading = 'Message from the expert'): string => {
    if (!note) return '';
    return `<div style="margin-top:16px;padding:12px 14px;border-left:3px solid #234C6A;background:#F5F3EF;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#7A7A72;">${heading}</p>
              <p style="margin:0;color:#1A3A4A;">${decisionNoteHtml(note)}</p>
            </div>`;
};
