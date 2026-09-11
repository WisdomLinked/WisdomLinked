import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const profileImageFetch = vi.fn();
vi.mock("../api/api", () => ({ profileImageFetch: (...a: any[]) => profileImageFetch(...a) }));

import { useResolvedProfileImages } from "./useResolvedProfileImages";

describe("useResolvedProfileImages", () => {
    beforeEach(() => {
        profileImageFetch.mockReset();
        profileImageFetch.mockResolvedValue("data:image/png;base64,RESOLVED");
    });

    it("resolves a stored filename into something an img can load", async () => {
        const { result } = renderHook(() =>
            useResolvedProfileImages([{ image: "google-profile_123.jpg" }]),
        );
        await waitFor(() => expect(result.current.get("google-profile_123.jpg")).toBeTruthy());
        expect(result.current.get("google-profile_123.jpg")).toBe("data:image/png;base64,RESOLVED");
        expect(profileImageFetch).toHaveBeenCalledTimes(1);
    });

    it("passes an already-displayable value through without fetching", async () => {
        const dataUri = "data:image/png;base64,ALREADYFINE";
        const { result } = renderHook(() => useResolvedProfileImages([{ image: dataUri }]));
        await waitFor(() => expect(result.current.get(dataUri)).toBe(dataUri));
        expect(profileImageFetch).not.toHaveBeenCalled();
    });

    it("fetches each distinct filename once, even when several people share one", async () => {
        const people = [
            { image: "same.jpg" },
            { image: "same.jpg" },
            { image: "other.jpg" },
        ];
        const { result } = renderHook(() => useResolvedProfileImages(people));
        await waitFor(() => expect(result.current.size).toBe(2));
        expect(profileImageFetch).toHaveBeenCalledTimes(2);
    });

    it("ignores people with no image and never fetches for them", async () => {
        const { result } = renderHook(() =>
            useResolvedProfileImages([{ username: "no photo" }, { image: "   " }, null]),
        );
        await waitFor(() => expect(result.current.size).toBe(0));
        expect(profileImageFetch).not.toHaveBeenCalled();
    });

    it("survives an empty or missing list", async () => {
        const a = renderHook(() => useResolvedProfileImages([]));
        const b = renderHook(() => useResolvedProfileImages(undefined));
        expect(a.result.current.size).toBe(0);
        expect(b.result.current.size).toBe(0);
        expect(profileImageFetch).not.toHaveBeenCalled();
    });

    it("does not refetch when re-rendered with an equivalent list", async () => {
        const { result, rerender } = renderHook(
            ({ people }) => useResolvedProfileImages(people),
            { initialProps: { people: [{ image: "a.jpg" }] as any[] } },
        );
        await waitFor(() => expect(result.current.size).toBe(1));
        // A fresh array of the same person — a new render, not new data.
        rerender({ people: [{ image: "a.jpg" }] });
        await waitFor(() => expect(result.current.size).toBe(1));
        expect(profileImageFetch).toHaveBeenCalledTimes(1);
    });

    it("leaves the map empty when resolution fails, so callers fall back to initials", async () => {
        profileImageFetch.mockRejectedValue(new Error("image service down"));
        const { result } = renderHook(() => useResolvedProfileImages([{ image: "broken.jpg" }]));
        await waitFor(() => expect(profileImageFetch).toHaveBeenCalled());
        expect(result.current.get("broken.jpg")).toBeUndefined();
    });
});
