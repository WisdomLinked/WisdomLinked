import { describe, expect, it } from "vitest";
import {
  STUDENT_RESUME_BLOCKED_MESSAGE,
  STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE,
  extensionFromUrl,
  isDocxZipMagic,
  isOleDocMagic,
  isPdfMagic,
  shouldBlockStudentResumeByExtension,
  shouldSendResumeFormatNotifyOnce,
} from "./resumePreviewHelpers";

describe("resumePreviewHelpers", () => {
  describe("extensionFromUrl", () => {
    it("parses extension from path before query/hash", () => {
      expect(extensionFromUrl("https://x.com/a/b/file.PDF?v=1")).toBe("pdf");
      expect(extensionFromUrl("/uploads/cv.docx")).toBe("docx");
      expect(extensionFromUrl("resume.final.doc")).toBe("doc");
    });

    it("returns empty for extensionless paths", () => {
      expect(extensionFromUrl("https://bucket/path/noext")).toBe("");
      expect(extensionFromUrl("")).toBe("");
    });
  });

  describe("shouldBlockStudentResumeByExtension", () => {
    it("allows pdf doc docx and extensionless", () => {
      expect(shouldBlockStudentResumeByExtension("")).toBe(false);
      expect(shouldBlockStudentResumeByExtension("pdf")).toBe(false);
      expect(shouldBlockStudentResumeByExtension("doc")).toBe(false);
      expect(shouldBlockStudentResumeByExtension("docx")).toBe(false);
    });

    it("blocks other extensions", () => {
      expect(shouldBlockStudentResumeByExtension("png")).toBe(true);
      expect(shouldBlockStudentResumeByExtension("xlsx")).toBe(true);
    });
  });

  describe("file magic detection", () => {
    it("isPdfMagic detects %PDF header", () => {
      const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
      expect(isPdfMagic(buf)).toBe(true);
      expect(isPdfMagic(new ArrayBuffer(2))).toBe(false);
    });

    it("isDocxZipMagic detects PK zip header", () => {
      const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
      expect(isDocxZipMagic(buf)).toBe(true);
    });

    it("isOleDocMagic detects OLE compound header", () => {
      const buf = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
      expect(isOleDocMagic(buf)).toBe(true);
    });
  });

  describe("shouldSendResumeFormatNotifyOnce", () => {
    it("fires once per expert id then suppresses", () => {
      const mem = new Map<string, string>();
      const storage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => void mem.set(k, v),
      };

      expect(shouldSendResumeFormatNotifyOnce("exp1", storage)).toBe(true);
      expect(shouldSendResumeFormatNotifyOnce("exp1", storage)).toBe(false);
      expect(shouldSendResumeFormatNotifyOnce("exp2", storage)).toBe(true);
    });
  });

  it("STUDENT_RESUME_BLOCKED_MESSAGE is stable copy for UI", () => {
    expect(STUDENT_RESUME_BLOCKED_MESSAGE).toContain("Word or PDF");
  });

  it("STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE does not promise an expert email", () => {
    expect(STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE).toContain("preview");
    expect(STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE.toLowerCase()).not.toContain("sent a note");
  });
});
