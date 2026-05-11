import type { Dispatch } from "redux";
import type { NavigateFunction } from "react-router-dom";
import { joinPrivateChat } from "../api/api";
import { setChosenChatDetails } from "../actions/chatActions";

function findDirectDmWithOther(
  directConversations: any[] | undefined,
  otherUserId: string,
  myUserId: string
): { other: any } | undefined {
  if (!directConversations?.length || !otherUserId || !myUserId) return undefined;
  const oid = String(otherUserId);
  const mid = String(myUserId);
  for (const conv of directConversations) {
    const parts: any[] = Array.isArray(conv?.participants) ? conv.participants : [];
    const hasMe = parts.some((p) => String(p?._id ?? p) === mid);
    const other = parts.find((p) => String(p?._id ?? p) === oid);
    if (hasMe && other) return { other };
  }
  return undefined;
}

const expertChatPath = () =>
  `${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`;

/**
 * Open a 1:1 Rocket.Chat DM (same thread as `getOrCreateDM` / Student private list).
 */
export async function openExpertChatWithUser(params: {
  dispatch: Dispatch;
  navigate: NavigateFunction;
  userDetails: any;
  otherUser: { _id: string; username?: string; image?: any };
}): Promise<void> {
  const { dispatch, navigate, userDetails, otherUser } = params;
  const otherId = String(otherUser._id);
  const myId = String(
    userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? ""
  );

  const existing = findDirectDmWithOther(
    userDetails?.directConversations,
    otherId,
    myId
  );

  if (existing?.other) {
    navigate(expertChatPath());
    dispatch(
      setChosenChatDetails({
        userId: otherId,
        username: existing.other.username ?? otherUser.username,
        image: existing.other.image ?? otherUser.image,
        peerRole:
          String(existing.other?.role || '')
            .toLowerCase()
            .trim() || undefined,
      })
    );
    return;
  }

  try {
    const response: any = await joinPrivateChat(otherId);
    const user = response?.user;
    const other = response?.otherUser;
    if (user) {
      dispatch({ type: "updateUserDetails", payload: user });
    }
    navigate(expertChatPath());
    dispatch(
      setChosenChatDetails({
        userId: otherId,
        username: other?.username ?? otherUser.username,
        image: other?.image ?? otherUser.image,
        peerRole:
          String(other?.role || '')
            .toLowerCase()
            .trim() || undefined,
      })
    );
  } catch {
    navigate(expertChatPath());
    dispatch(
      setChosenChatDetails({
        userId: otherUser._id,
        username: otherUser.username,
        image: otherUser.image,
        peerRole:
          String((otherUser as any)?.role || '')
            .toLowerCase()
            .trim() || undefined,
      })
    );
  }
}
