import { describe, expect, it, vi } from "vitest";
import { isDisplayImageUrl, resolveProfileImageSrc } from "./profileImage";

describe("profileImage utils", () => {
  it("accepts directly displayable image URLs", () => {
    expect(isDisplayImageUrl("https://x.y/a.png")).toBe(true);
    expect(isDisplayImageUrl("http://x.y/a.png")).toBe(true);
    expect(isDisplayImageUrl("data:image/png;base64,abc")).toBe(true);
    expect(isDisplayImageUrl("blob:abc")).toBe(true);
    expect(isDisplayImageUrl("/uploads/a.png")).toBe(true);
  });

  it("rejects empty and non-displayable values", () => {
    expect(isDisplayImageUrl("")).toBe(false);
    expect(isDisplayImageUrl("avatar-id-from-api")).toBe(false);
    expect(isDisplayImageUrl(null)).toBe(false);
  });

  it("resolves direct URL without calling fetcher", async () => {
    const fetcher = vi.fn();
    const out = await resolveProfileImageSrc("https://x.y/a.png", "small", fetcher);
    expect(out).toBe("https://x.y/a.png");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("resolves API ref through fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue("https://cdn/a.png");
    const out = await resolveProfileImageSrc("avatar-ref-1", "small", fetcher);
    expect(out).toBe("https://cdn/a.png");
    expect(fetcher).toHaveBeenCalledWith("avatar-ref-1", "small");
  });

  it("returns null when fetcher fails or returns non-string", async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const badFetcher = vi.fn().mockResolvedValue({ bad: true });
    await expect(resolveProfileImageSrc("avatar-ref-2", "small", failFetcher)).resolves.toBeNull();
    await expect(resolveProfileImageSrc("avatar-ref-3", "small", badFetcher)).resolves.toBeNull();
  });
});

