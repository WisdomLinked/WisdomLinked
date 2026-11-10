import { useCallback, useState } from "react";
import ProfileModal from "../pages/Dashboard/Messenger/Messages/ProfileModal";
import { buildFallbackChatProfile, mergeChatProfile } from "../utils/chatProfileModal";
import { fetchChatUserProfile } from "../api/chatApi";

export interface PeerProfileSeed {
  userId: string;
  username?: string;
  image?: string | null;
  /** When known (e.g. admin User management), seed the card with the correct layout immediately. */
  role?: string;
  email?: string;
  title?: string;
}

/**
 * usePeerProfileModal — opens the shared <ProfileCard> (via ProfileModal) for any
 * person, from any surface (seminars, calendars, …). Shows a fallback card
 * immediately from the seed, then enriches it once the full profile loads.
 *
 * Returns the render-ready modal element plus an `openPeerProfile(seed)` action;
 * the host screen only supplies the person to show — everything around the card
 * (buttons, session context) stays on the screen, per the profile-card spec.
 */
export function usePeerProfileModal(viewerRole?: string) {
  const [peerProfile, setPeerProfile] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const openPeerProfile = useCallback(
    async (seed: PeerProfileSeed) => {
      const peerId = String(seed?.userId || "");
      if (!peerId) return;
      const fallback = buildFallbackChatProfile(
        {
          userId: peerId,
          username: seed.username,
          image: seed.image ?? null,
          role: seed.role,
          email: seed.email,
          title: seed.title,
        },
        String(viewerRole || ""),
      );
      setPeerProfile(fallback);
      setOpen(true);
      const response: any = await fetchChatUserProfile(peerId);
      if (response?.success && response?.result) {
        setPeerProfile(mergeChatProfile(fallback, response.result));
      }
    },
    [viewerRole],
  );

  const closePeerProfile = useCallback(() => {
    setOpen(false);
    setPeerProfile(null);
  }, []);

  const peerProfileModal = peerProfile ? (
    <ProfileModal
      isOpen={open}
      onClose={closePeerProfile}
      userDetails={peerProfile}
      viewerRole={viewerRole}
      previewImage={peerProfile?.image}
    />
  ) : null;

  return { openPeerProfile, closePeerProfile, peerProfileModal };
}
