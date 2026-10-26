const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

const MAX_SIGNATURE_BYTES = 500 * 1024;

const ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "div", "span", "blockquote",
    "ul", "ol", "li",
    "strong", "em", "b", "i", "u", "sub", "sup",
    "a",
    "table", "thead", "tbody", "tr", "th", "td",
];

function sha256Text(value: string): string {
    return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function sha256Buffer(value: Buffer): string {
    return crypto.createHash("sha256").update(value).digest("hex");
}

/** Strip scripts and event handlers. Keep headings, paragraphs, lists, and basic formatting. */
function sanitizeTermsHtml(html: string): string {
    return sanitizeHtml(String(html || ""), {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: {
            a: ["href", "name", "target", "rel"],
            th: ["colspan", "rowspan"],
            td: ["colspan", "rowspan"],
        },
        allowedSchemes: ["http", "https", "mailto"],
        allowProtocolRelative: false,
        disallowedTagsMode: "discard",
    }).trim();
}

function termsError(status: number, publicMessage: string) {
    const err: any = new Error(publicMessage);
    err.status = status;
    err.publicMessage = publicMessage;
    return err;
}

/**
 * Accept a drawn signature only as a PNG data URL, capped near 500KB.
 * An empty value means they did not draw one.
 */
function parseSignaturePng(value: unknown): { png: string } | { error: string } {
    if (value == null || String(value).trim() === "") return { png: "" };
    const raw = String(value).trim();
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw);
    if (!match) return { error: "Signature must be a PNG image." };
    const b64 = match[1].replace(/\s/g, "");
    const buf = Buffer.from(b64, "base64");
    if (!buf.length || buf.length > MAX_SIGNATURE_BYTES) {
        return { error: "Signature image must be 500KB or smaller." };
    }
    const png =
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!png) return { error: "Signature must be a PNG image." };
    return { png: `data:image/png;base64,${b64}` };
}

module.exports = {
    MAX_SIGNATURE_BYTES,
    sha256Text,
    sha256Buffer,
    sanitizeTermsHtml,
    termsError,
    parseSignaturePng,
};
