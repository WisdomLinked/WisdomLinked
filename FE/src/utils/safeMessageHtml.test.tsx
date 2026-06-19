import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderSafeMessageHtml, sanitizeMessageHtml } from "./safeMessageHtml";

describe("renderSafeMessageHtml", () => {
  it("removes scripts and event handlers while preserving simple formatting", () => {
    render(
      <div>
        {renderSafeMessageHtml('<strong>Hello</strong><img src=x onerror="alert(1)"><script>alert(1)</script>')}
      </div>,
    );

    expect(screen.getByText("Hello").tagName.toLowerCase()).toBe("strong");
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps safe links and drops unsafe hrefs", () => {
    render(
      <div>
        {renderSafeMessageHtml('<a href="https://example.com">safe</a><a href="javascript:alert(1)">bad</a>')}
      </div>,
    );

    expect(screen.getByText("safe")).toHaveAttribute("href", "https://example.com");
    expect(screen.getByText("bad")).not.toHaveAttribute("href");
  });

  it("sanitizes outgoing rich editor HTML before send", () => {
    expect(
      sanitizeMessageHtml('<p>Hello <img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a></p>'),
    ).toBe("<p>Hello <a>bad</a></p>");
  });

  it("keeps safe span color styles", () => {
    expect(
      sanitizeMessageHtml('<p><span style="color: rgb(230, 0, 0);">red</span></p>'),
    ).toContain("color: rgb(230, 0, 0)");
  });

  it("renders span color styles as React style objects", () => {
    const { container } = render(
      <div>
        {renderSafeMessageHtml('<p><span style="color: rgb(230, 0, 0);">red</span></p>')}
      </div>,
    );
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span).toHaveStyle({ color: "rgb(230, 0, 0)" });
  });

  it("keeps Quill list markers and alignment classes", () => {
    expect(
      sanitizeMessageHtml(
        '<ol><li data-list="ordered">a</li><li data-list="bullet" class="ql-indent-1">b</li></ol><p class="ql-align-center">center</p>',
      ),
    ).toContain('data-list="ordered"');
    expect(
      sanitizeMessageHtml(
        '<ol><li data-list="ordered">a</li><li data-list="bullet" class="ql-indent-1">b</li></ol><p class="ql-align-center">center</p>',
      ),
    ).toContain('class="ql-align-center"');
  });
});
