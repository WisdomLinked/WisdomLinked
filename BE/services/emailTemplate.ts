const fs = require("fs");
const path = require("path");
const { resolveAppBaseUrl } = require("../utils/appBaseUrl");

const HEADER_CID = "wisdomlinked-header";
const HEADER_FILENAME = "wisdomlinked.png";
// Must resolve inside the backend package: the Docker build context is ./BE, so
// anything under FE/ is absent from the running image.
const HEADER_SOURCES = [
    process.env.EMAIL_HEADER_IMAGE,
    path.join(__dirname, "..", "assets", "email-header.png"),
].filter(Boolean);

let headerCache: { base64: string; width: number } | null = null;
let headerMissLogged = false;

const MAX_HEADER_DISPLAY_WIDTH = 220;

const pngDisplayWidth = (buffer: any): number => {
    const isPng = buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG";
    if (!isPng) return MAX_HEADER_DISPLAY_WIDTH;
    const pixelWidth = buffer.readUInt32BE(16);
    if (!pixelWidth) return MAX_HEADER_DISPLAY_WIDTH;
    return Math.min(MAX_HEADER_DISPLAY_WIDTH, Math.round(pixelWidth / 2));
};

const headerImage = () => {
    // Only a hit is cached. Caching a miss would strand a process that started
    // before the asset was deployed on the wordmark fallback forever.
    if (headerCache) return headerCache;
    for (const candidate of HEADER_SOURCES) {
        try {
            if (candidate && fs.existsSync(candidate)) {
                const buffer = fs.readFileSync(candidate);
                headerCache = { base64: buffer.toString("base64"), width: pngDisplayWidth(buffer) };
                return headerCache;
            }
        } catch (err: any) {
            console.log("[emailTemplate] could not read header image", candidate, err?.message);
        }
    }
    if (!headerMissLogged) {
        headerMissLogged = true;
        console.error("[emailTemplate] no header image found — every email will fall back to the wordmark. Looked in:", HEADER_SOURCES.join(", "));
    }
    return null;
};

const emailAttachments = () => {
    const image = headerImage();
    if (!image) return [];
    return [{
        content: image.base64,
        filename: HEADER_FILENAME,
        type: "image/png",
        disposition: "inline",
        content_id: HEADER_CID,
    }];
};

const BRAND = {
    banner: '#12294A',
    ink: '#1A3A4A',
    muted: '#5B6B77',
    faint: '#7A7A72',
    border: '#E5E2DB',
    page: '#F1EFEA',
    card: '#FFFFFF',
    accent: '#234C6A',
    gold: '#C9A84C',
    goodBg: '#EAF4EC',
    warnBg: '#FEF3C7',
    warnBorder: '#C9A84C',
    badBg: '#FDECEC',
    badBorder: '#E4A0A0',
};

const escapeHtml = (value: any): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const money = (amountDollars: any, currency?: string): string => {
    const n = Number(amountDollars);
    const safe = Number.isFinite(n) ? n : 0;
    const code = String(currency || 'USD').toUpperCase();
    return code === 'USD' ? `$${safe.toFixed(2)}` : `$${safe.toFixed(2)} ${code}`;
};

const moneyFromCents = (amountCents: any, currency?: string): string =>
    money(Number(amountCents || 0) / 100, currency);

const formatWhen = (value: any, timeZone?: string): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
        return date.toLocaleString('en-US', {
            timeZone: timeZone || 'UTC',
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        });
    } catch {
        return date.toLocaleString('en-US');
    }
};

const paragraph = (html: string, opts: any = {}) => `
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${opts.muted ? BRAND.muted : BRAND.ink};">${html}</p>`;

const strong = (text: any) => `<strong style="color:${BRAND.ink};">${escapeHtml(text)}</strong>`;

const facts = (rows: Array<[string, any]>) => {
    const body = rows
        .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
        .map(
            ([label, value]) => `
            <tr>
                <td style="padding:7px 14px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
                <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${BRAND.ink};vertical-align:top;">${escapeHtml(value)}</td>
            </tr>`,
        )
        .join('');
    if (!body) return '';
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px 0;background:${BRAND.page};border-radius:10px;">
        <tr><td style="padding:8px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>
        </td></tr>
    </table>`;
};

const bullets = (items: string[]) => {
    const rows = items
        .filter(Boolean)
        .map(
            (item) => `
            <tr>
                <td width="18" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.gold};vertical-align:top;">&bull;</td>
                <td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.ink};">${item}</td>
            </tr>`,
        )
        .join('');
    if (!rows) return '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px 0;">${rows}</table>`;
};

const button = (label: string, url?: string) => {
    const href = url || resolveAppBaseUrl();
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px 0;">
        <tr><td align="center" bgcolor="${BRAND.accent}" style="border-radius:8px;">
            <a href="${href}" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
        </td></tr>
    </table>`;
};

const callout = (html: string, tone: 'neutral' | 'good' | 'warn' | 'bad' = 'neutral') => {
    const palette = {
        neutral: { bg: BRAND.page, border: BRAND.border },
        good: { bg: BRAND.goodBg, border: '#9CC3A6' },
        warn: { bg: BRAND.warnBg, border: BRAND.warnBorder },
        bad: { bg: BRAND.badBg, border: BRAND.badBorder },
    }[tone];
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px 0;background:${palette.bg};border-left:4px solid ${palette.border};border-radius:6px;">
        <tr><td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.ink};">${html}</td></tr>
    </table>`;
};

const expertNote = (note?: string, label = "Expert's note") => {
    const trimmed = String(note || '').trim();
    if (!trimmed) return '';
    return callout(
        `<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};margin-bottom:6px;">${escapeHtml(label)}</span>${escapeHtml(trimmed)}`,
    );
};

const codeBlock = (code: any) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 18px 0;background:${BRAND.page};border-radius:10px;">
        <tr><td align="center" style="padding:22px 16px;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:bold;letter-spacing:10px;color:${BRAND.accent};">${escapeHtml(code)}</td></tr>
    </table>`;

const renderEmail = ({ heading, blocks = [] as string[], previewText = '' }: any) => {
    const body = blocks.filter(Boolean).join('\n');
    const preview = previewText
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>`
        : '';
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>WisdomLinked</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};">
${preview}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.page};">
    <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
            <tr>
                <td align="center" bgcolor="${BRAND.banner}" style="background:${BRAND.banner};padding:22px 24px;">
                    ${headerImage()
                        ? `<img src="cid:${HEADER_CID}" alt="WisdomLinked" width="${headerImage().width}" style="display:block;width:${headerImage().width}px;max-width:70%;height:auto;border:0;" />`
                        : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1;letter-spacing:0.5px;color:#FFFFFF;">Wisdom<span style="color:${BRAND.gold};">Linked</span></div>`}
                </td>
            </tr>
            <tr><td style="padding:28px 30px 8px 30px;">
                <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.35;font-weight:normal;color:${BRAND.ink};">${escapeHtml(heading)}</h1>
                ${body}
            </td></tr>
            <tr><td style="padding:6px 30px 26px 30px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td style="border-top:1px solid ${BRAND.border};padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.faint};">
                        Questions? Contact the administrator through WisdomLinked.<br />
                        Thank you for using <span style="color:${BRAND.ink};">WisdomLinked</span>.
                    </td></tr>
                </table>
            </td></tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
            <tr><td align="center" style="padding:14px 10px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${BRAND.faint};">
                This is an automated message from WisdomLinked. Please do not reply to this email.
            </td></tr>
        </table>
    </td></tr>
</table>
</body></html>`;
};

module.exports = {
    BRAND,
    renderEmail,
    emailAttachments,
    HEADER_CID,
    escapeHtml,
    money,
    moneyFromCents,
    formatWhen,
    paragraph,
    strong,
    facts,
    bullets,
    button,
    codeBlock,
    callout,
    expertNote,
};
