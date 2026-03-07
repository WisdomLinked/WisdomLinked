import React, { useMemo } from "react";
import { styled } from "@mui/system";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
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

    const chats = [...(userDetails.generalChats || []), ...(userDetails.groupChats || []), ...(userDetails.privateChats || [])];
    const results: Array<{ chat: any; other: any; otherId: string; otherName: string }> = [];

    for (const g of chats) {
      // only individual/private chats
      if (g?.type && g.type !== "individual" && g.type !== "private") continue;

      // if participants array exists and is populated, find the other participant
      if (Array.isArray(g?.participants) && g.participants.length > 0) {
        const other = g.participants.find((p: any) => {
          const pid = typeof p === "string" ? p : p?._id ?? p?.id;
          return String(pid) !== String(currentUserId);
        });
        if (other) {
          const otherId = typeof other === "string" ? other : other?._id ?? other?.id;
          const otherName = typeof other === "string" ? other : other?.username ?? other?.email ?? String(otherId);
          results.push({ chat: g, other, otherId: String(otherId), otherName });
          continue;
        }
      }

      // fallback: admin/owner fields
      const admin = g?.admin ?? g?.owner ?? g?.creator ?? g?.user;
      const adminId = admin?._id ?? admin?.id ?? admin;
      if (adminId && String(adminId) !== String(currentUserId)) {
        const otherName = admin?.username ?? admin?.email ?? String(adminId);
        results.push({ chat: g, other: admin, otherId: String(adminId), otherName });
        continue;
      }

      // If chat isn't populated (only an id), we can't show the other user's name here.
      // Skip such chats.
    }

    return results;
  }, [userDetails, currentUserId]);

  // Now it's safe to early return for UI when no userDetails.
  if (!userDetails) return null;

  const openChat = (chatObj: any) => {
    const chosen = {
      ...chatObj.chat,
      groupId: chatObj.chat._id ?? chatObj.chat.groupId,
      groupName: chatObj.otherName ?? chatObj.chat.name ?? chatObj.chat.groupName,
    };
    dispatch(setChosenGroupChatDetails(chosen));
    navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`);
  };

  if (privateChats.length === 0) {
    return (
      <MainContainer>
        <SearchInput type="text" placeholder="Search your private chats..." disabled />
        <div className="text-lightgrey text-center mt-6">
          No private chats found. (If you expect chats to appear, ensure userDetails.generalChats is populated with participant objects on login.)
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <SearchInput type="text" placeholder="Search your private chats..." onChange={() => { }} />
      {privateChats.map((p) => (
        <div
          key={p.chat._id ?? p.chat.groupId ?? p.otherId}
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
            <div className="text-xs text-white">{p.chat.title ?? ""}</div>
          </div>
        </div>
      ))}
    </MainContainer>
  );
};

export default CustomerPrivateExpertsList;