import { afterEach, describe, expect, it } from "vitest";
import { hasResumeForPreview, resolveResumePublicUrl } from "./resumeUrl";

describe("resumeUrl", () => {
  const origBase = process.env.REACT_APP_SERVER_URL;

  afterEach(() => {
    if (origBase === undefined) delete process.env.REACT_APP_SERVER_URL;
    else process.env.REACT_APP_SERVER_URL = origBase;
  });

  it("resolveResumePublicUrl returns empty for empty / non-string input", () => {
    expect(resolveResumePublicUrl("")).toBe("");
    expect(resolveResumePublicUrl("   ")).toBe("");
    expect(resolveResumePublicUrl(null)).toBe("");
    expect(resolveResumePublicUrl(undefined)).toBe("");
  });

  it("resolveResumePublicUrl keeps absolute http(s) URLs", () => {
    expect(resolveResumePublicUrl("https://cdn.example.com/files/a.pdf")).toBe(
      "https://cdn.example.com/files/a.pdf",
    );
    expect(resolveResumePublicUrl("http://localhost/x.doc")).toBe("http://localhost/x.doc");
  });

  it("resolveResumePublicUrl prefixes relative paths with REACT_APP_SERVER_URL", () => {
    process.env.REACT_APP_SERVER_URL = "https://api.example.com";
    expect(resolveResumePublicUrl("uploads/resume.pdf")).toBe("https://api.example.com/uploads/resume.pdf");
    expect(resolveResumePublicUrl("/uploads/r.docx")).toBe("https://api.example.com/uploads/r.docx");
  });

  it("resolveResumePublicUrl strips trailing slash from server base", () => {
    process.env.REACT_APP_SERVER_URL = "https://api.example.com/";
    expect(resolveResumePublicUrl("path/cv.pdf")).toBe("https://api.example.com/path/cv.pdf");
  });

  it("hasResumeForPreview is false when nothing resolvable", () => {
    expect(hasResumeForPreview("")).toBe(false);
    expect(hasResumeForPreview(null)).toBe(false);
  });

  it("hasResumeForPreview is true when URL resolves non-empty", () => {
    process.env.REACT_APP_SERVER_URL = "https://api.example.com";
    expect(hasResumeForPreview("files/a.pdf")).toBe(true);
    expect(hasResumeForPreview("https://x/y")).toBe(true);
  });
});
