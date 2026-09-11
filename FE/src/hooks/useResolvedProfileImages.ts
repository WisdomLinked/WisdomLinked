import { useEffect, useRef, useState } from "react";
import { resolveProfileImageSrc } from "../utils/profileImage";
import { profileImageFetch } from "../api/api";

/**
 * `user.image` is usually a stored filename, not something an <img> can load — it has to
 * go through the image service first. Screens that forget this render every member as
 * their initials, so the resolution lives here rather than being copied per screen.
 *
 * Values that are already displayable (OAuth URLs, data URIs) pass straight through;
 * each filename is fetched once and cached for the life of the component.
 */
export const useResolvedProfileImages = (
    people: readonly any[] | null | undefined,
): Map<string, string> => {
    const [resolved, setResolved] = useState<Map<string, string>>(new Map());
    const cacheRef = useRef(new Map<string, string>());

    // The refs themselves are the dependency: a new array of the same people must not
    // re-run the effect, or every render would schedule another round of fetches.
    const refs = (people || [])
        .map((person: any) => (typeof person?.image === "string" ? person.image.trim() : ""))
        .filter(Boolean);
    const refsKey = refs.join("|");

    useEffect(() => {
        let cancelled = false;
        const pending = refs.filter((ref) => !cacheRef.current.has(ref));
        if (pending.length === 0) return;

        void Promise.all(
            Array.from(new Set(pending)).map(async (ref) => {
                const src = await resolveProfileImageSrc(ref, "small", profileImageFetch as any);
                if (src) cacheRef.current.set(ref, src);
            }),
        ).then(() => {
            if (!cancelled) setResolved(new Map(cacheRef.current));
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refsKey]);

    return resolved;
};

export default useResolvedProfileImages;
