import { describe, expect, it } from "vitest";
import { decodeRichHtmlWire, resolveMessageDisplayHtml } from "./chatRichHtmlWire";

describe("chatRichHtmlWire", () => {
  it("decodes stored rich wire messages", () => {
    const html = "<p><strong>Hi</strong></p>";
    const wire = `__WL_HTML__|${encodeURIComponent(html)}`;
    expect(decodeRichHtmlWire(wire)).toBe(html);
    expect(resolveMessageDisplayHtml(wire)).toBe(html);
  });

  it("passes through legacy plain text", () => {
    expect(resolveMessageDisplayHtml("hello there")).toBe("hello there");
  });
});
