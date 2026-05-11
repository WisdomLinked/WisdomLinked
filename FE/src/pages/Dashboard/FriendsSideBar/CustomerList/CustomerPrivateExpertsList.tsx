import React, { useMemo } from "react";
import { styled } from "@mui/system";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setChosenChatDetails } from "../../../../actions/chatActions";
import { useAppSelector } from "../../../../store";

const MainContainer = styled("div")({
  flexGrow: 1,
  width: "100%",
  margin: "20px 0",
});

const SearchInput = styled("input")({
  width: "100%",
  padding: "10px",
  marginBottom: "20px",
  borderRadius: "5px",
  border: "1px solid #444",
  fontSize: "16px",
  backgroundColor: "#222",
  color: "#fff",
  outline: "none",
  caretColor: "#00ffff",
  "::placeholder": {
    color: "#888",
  },
});

const CustomerPrivateExpertsList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    auth: { userDetails },
  } = useAppSelector((s) => s);

  // derive currentUserId (can be null). It's okay to compute before useMemo.
  const currentUserId = userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? null;

  // Call useMemo unconditionally. Inside the memo we guard for missing userDetails.
  const privateChats = useMemo(() => {
    if (!userDetails) return [];

    const seen = new Set<string>();
    const results: Array<{
      otherId: string;
      otherName: string;
      subtitle: string;
      image?: string | null;
      peerRole?: string;
    }> = [];

    const dcs = userDetails.directConversations ?? [];
    for (const conv of dcs) {
      if (!conv?.participants?.length) continue;
      const other = conv.participants.find(
        (p: any) => String(p?._id ?? p?.id) !== String(currentUserId),
      );
      if (!other) continue;
      const otherId = String(other._id ?? other.id);
      if (seen.has(otherId)) continue;
      seen.add(otherId);
      results.push({
        otherId,
        otherName: other.username ?? other.email ?? otherId,
        subtitle: "Direct message",
        image: other.image ?? null,
        peerRole: String(other.role || '').toLowerCase() || undefined,
      });
    }

    return results;
  }, [userDetails, currentUserId]);

  // Now it's safe to early return for UI when no userDetails.
  if (!userDetails) return null;

  const openChat = (row: { otherId: string; otherName: string; image?: string | null; peerRole?: string }) => {
    dispatch(
      setChosenChatDetails({
        userId: row.otherId,
        username: row.otherName,
        image: row.image,
        peerRole: row.peerRole,
      }),
    );
    navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`);
  };

  if (privateChats.length === 0) {
    return (
      <MainContainer>
        <SearchInput type="text" placeholder="Search your private chats..." disabled />
        <div className="text-lightgrey text-center mt-6">
          No private chats yet. Open a conversation from the messenger to start one.
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <SearchInput type="text" placeholder="Search your private chats..." onChange={() => {}} />
      {privateChats.map((p) => (
        <div
          key={p.otherId}
          className="flex items-center gap-3 p-2 rounded hover:bg-black/20 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => openChat(p)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              openChat(p);
            }
          }}
        >
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{p.otherName}</div>
            <div className="text-xs text-white">{p.subtitle}</div>
          </div>
        </div>
      ))}
    </MainContainer>
  );
};

export default CustomerPrivateExpertsList;