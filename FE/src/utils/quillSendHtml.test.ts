import { describe, expect, it } from "vitest";
import { isQuillComposerEmpty, normalizeQuillHtmlForSend } from "./quillSendHtml";

describe("quillSendHtml", () => {
  it("treats empty Quill state as empty", () => {
    expect(isQuillComposerEmpty("")).toBe(true);
    expect(isQuillComposerEmpty("<p><br></p>")).toBe(true);
  });

  it("preserves formatted HTML for send", () => {
    const html = "<p><strong>bold</strong></p>";
    expect(normalizeQuillHtmlForSend(html)).toBe(html);
  });

  it("trims trailing blank paragraphs", () => {
    expect(normalizeQuillHtmlForSend("<p>hi</p><p><br></p>")).toBe("<p>hi</p>");
  });
});
