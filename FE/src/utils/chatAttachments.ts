/** Shared chat attachment limits (FE composer + BE multer must stay aligned). */
export const MAX_CHAT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CHAT_FILES_PER_MESSAGE = 5;

export const ALLOWED_CHAT_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
] as const;

export const CHAT_FILE_ACCEPT = ALLOWED_CHAT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export const CHAT_FILE_REQUIREMENTS_MESSAGE =
  'Allowed formats: JPG, PNG, WEBP, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT. Max size: 10 MB per file. Up to 5 files per message.';

export const CHAT_FILE_SIZE_EXCEEDED_MESSAGE = 'File is too large. Max size: 10 MB per file.';

export function getChatFileExtension(name: string): string {
  const value = (name || '').trim();
  if (!value.includes('.')) return '';
  return value.split('.').pop()?.toLowerCase() || '';
}

export function isAllowedChatFileName(name: string): boolean {
  const ext = getChatFileExtension(name);
  return !!ext && (ALLOWED_CHAT_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

export function formatChatFileBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/** Escape plain text and convert newlines + http(s) URLs for safe chat HTML. */
export function plainTextToSafeMessageHtml(text: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const linkifyLine = (line: string) => {
    const escaped = escape(line);
    return escaped.replace(
      /(https?:\/\/[^\s<&]+)/gi,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`,
    );
  };

  return String(text || '')
    .split(/\r\n|\r|\n/)
    .map(linkifyLine)
    .join('<br>');
}

export function isComposerTextEmpty(text: string): boolean {
  return !String(text || '').trim();
}
