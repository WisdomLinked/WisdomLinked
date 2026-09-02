import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Message from "../pages/Dashboard/Messenger/Messages/Message";
import { peelWisdomLinkedReplyQuotes } from "./chatReplyLayout";
import { decodeRichHtmlWire } from "./chatRichHtmlWire";
import { RICH_FORMATTING_SAMPLES } from "./chatRichFormatting.fixtures";
import { normalizeQuillHtmlForSend } from "./quillSendHtml";
import { renderSafeMessageHtml, sanitizeMessageHtml } from "./safeMessageHtml";

/** Mirrors BE encodeRichHtmlWire for integration simulation. */
function encodeRichHtmlWire(html: string): string {
  const raw = String(html ?? "").trim();
  if (!raw) return "";
  return `__WL_HTML__|${encodeURIComponent(raw)}`;
}

/** Mirrors BE hasRichHtmlMarkup for integration simulation. */
function shouldUseRichWire(html: string): boolean {
  const raw = String(html ?? "").trim();
  if (!raw || raw === "<p><br></p>") return false;
  if (/<(strong|em|u|s|b|i|span|h[1-6]|ul|ol|li|blockquote|pre|code|a)\b/i.test(raw)) {
    return true;
  }
  if (/(<\/p>\s*<p|<br\s*\/?>)/i.test(raw)) return true;
  if (/\bql-(indent|align|syntax)\b/i.test(raw)) return true;
  return false;
}

function simulateOutgoingStorage(sanitizedHtml: string): string {
  if (!shouldUseRichWire(sanitizedHtml)) {
    let out = sanitizedHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
    let previous: string;
    do {
      previous = out;
      out = out.replace(/<[^<>]*>/g, "");
    } while (out !== previous);
    return out.replace(/&nbsp;/g, " ").trim();
  }
  return encodeRichHtmlWire(sanitizedHtml);
}

describe("chat rich formatting integration (FE)", () => {
  it.each(RICH_FORMATTING_SAMPLES.map((s) => [s.id, s] as const))(
    "%s: sanitize → wire → decode preserves content",
    (_id, sample) => {
      const normalized = normalizeQuillHtmlForSend(sample.quillHtml);
      const sanitized = sanitizeMessageHtml(normalized);
      const stored = simulateOutgoingStorage(sanitized);

      if (sample.expectPlainStorage) {
        expect(stored).not.toMatch(/^__WL_HTML__\|/);
        expect(stored).toContain(sample.textIncludes);
        return;
      }

      expect(stored.startsWith("__WL_HTML__|")).toBe(true);
      const decoded = decodeRichHtmlWire(stored);
      expect(decoded).toBeTruthy();
      expect(decoded).toContain(sample.textIncludes);
    },
  );

  it.each(
    RICH_FORMATTING_SAMPLES.filter((s) => !s.expectPlainStorage).map(
      (s) => [s.id, s] as const,
    ),
  )("%s: stored wire renders expected DOM in Message bubble", (_id, sample) => {
    const sanitized = sanitizeMessageHtml(normalizeQuillHtmlForSend(sample.quillHtml));
    const wire = simulateOutgoingStorage(sanitized);

    const { container } = render(
      <Message
        content={wire}
        hideDate
        incomingMessage={false}
        theme="light"
        messageId="m-test"
        roomId="r-test"
      />,
    );

    expect(screen.getByText(new RegExp(sample.textIncludes, "i"))).toBeInTheDocument();

    if (sample.renderTag) {
      const el = screen.getByText(new RegExp(sample.textIncludes, "i"));
      expect(el.tagName.toLowerCase()).toBe(sample.renderTag);
    }

    if (sample.renderSelector) {
      expect(container.querySelector(sample.renderSelector)).toBeTruthy();
    }
  });

  it.each(
    RICH_FORMATTING_SAMPLES.filter((s) => !s.expectPlainStorage).map(
      (s) => [s.id, s] as const,
    ),
  )("%s: peel + renderSafeMessageHtml preserves structure", (_id, sample) => {
    const sanitized = sanitizeMessageHtml(normalizeQuillHtmlForSend(sample.quillHtml));
    const wire = simulateOutgoingStorage(sanitized);
    const { bodyHtml } = peelWisdomLinkedReplyQuotes(wire);

    const { container } = render(
      <div>{renderSafeMessageHtml(bodyHtml || wire)}</div>,
    );

    expect(container.textContent).toMatch(new RegExp(sample.textIncludes, "i"));
    if (sample.renderSelector) {
      expect(container.querySelector(sample.renderSelector)).toBeTruthy();
    }
  });
});
