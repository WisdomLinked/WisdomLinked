import React, { useEffect, useState } from "react";
import { styled } from "@mui/system";
import { doFilterCustomers, profileImageFetch, joinPrivateChat } from "../../../../api/api";
import { SetLoadingStatus } from "../../../../actions/appActions";
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

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s) => s);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerImages, setCustomerImages] = useState<Array<string | null>>([]);
  const [loadingFetch, setLoadingFetch] = useState<boolean>(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchCustomers = async (query = "") => {
    setLoadingFetch(true);
    SetLoadingStatus(true);
    try {
      const res: any = await doFilterCustomers({ username: query });
      if (res?.result) {
        setCustomers(res.result);

        // Explicitly type the Promise.all result so TypeScript knows it's (string | null)[]
        const imgs = (await Promise.all(
          res.result.map((c: any) =>
            c.image ? profileImageFetch(c.image, "small").catch(() => null) : Promise.resolve(null)
          )
        )) as Array<string | null>;

        setCustomerImages(imgs);
      } else {
        setCustomers([]);
        setCustomerImages([]);
      }
    } catch (err) {
      console.error("fetchCustomers error:", err);
      setCustomers([]);
      setCustomerImages([]);
    } finally {
      SetLoadingStatus(false);
      setLoadingFetch(false);
    }
  };

  // join general chat: backend expects personId in body, but the frontend api wrapper accepts the clicked user's id (string).
  // Call joinGeneralChat with the string id to satisfy TypeScript signature.
  const handleJoinChat = async (otherUserId: string) => {
    SetLoadingStatus(true);
    try {
      // Call API wrapper with the string id (match its TypeScript signature)
      const response: any = await joinPrivateChat(otherUserId);

      // Normalize axios/other shapes: response.data vs direct
      const payload = response?.data ?? response;
      const user = payload?.user ?? payload;
      // Chat might be returned directly as payload.chat or be present inside user.generalChats
      const chat = payload?.chat ?? user?.generalChats?.find((g: any) => {
        const adminIdInChat = g?.admin?._id ?? g?.admin;
        return String(adminIdInChat) === String(otherUserId);
      });

      if (!user) {
        console.warn("joinPrivateChat: no user returned from API", payload);
        return;
      }

      // Update redux user details
      dispatch({
        type: "updateUserDetails",
        payload: user,
      });

      if (chat) {
        // Normalize chosen chat object to shape expected by setChosenGroupChatDetails
        const chosen = {
          ...chat,
          groupId: chat._id ?? chat.groupId,
          groupName: chat.name ?? chat.groupName,
        };

        dispatch(setChosenGroupChatDetails(chosen));
      } else {
        // Defensive fallback: search user's generalChats again
        const fallbackChat = (user.generalChats || []).find((g: any) => {
          const adminIdInChat = g?.admin?._id ?? g?.admin;
          return String(adminIdInChat) === String(otherUserId);
        });
        if (fallbackChat) {
          dispatch(setChosenGroupChatDetails({
            ...fallbackChat,
            groupId: fallbackChat._id ?? fallbackChat.groupId,
            groupName: fallbackChat.name ?? fallbackChat.groupName,
          }));
        } else {
          console.warn("joinGeneralChat: could not find chat for chosen person in returned user.generalChats");
        }
      }

      navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
    } catch (err) {
      console.error("joinGeneralChat error:", err);
    } finally {
      SetLoadingStatus(false);
    }
  };

  // initial: fetch empty query to list customers (optional)
  useEffect(() => {
    fetchCustomers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MainContainer>
      <SearchInput
        type="text"
        placeholder="Search customers..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {loadingFetch && customers.length === 0 ? (
        <div className="text-lightgrey text-center">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-lightgrey text-center mt-6">No customers found</div>
      ) : (
        customers.map((c: any, i: number) => (
          // Make the whole row clickable so clicking profile opens the chat.
          <div
            key={c._id}
            className="flex items-center gap-3 p-2 rounded hover:bg-black/20 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => handleJoinChat(c._id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleJoinChat(c._id);
              }
            }}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-grey flex items-center justify-center text-white">
              {customerImages[i] ? (
                <img src={customerImages[i]!} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                (c.username?.charAt(0) || "U")
              )}
            </div>
            <div className="flex-1">
                <div className="text-sm font-bold text-white">{c.username}</div>
                <div className="text-xs text-white">{c.title}</div>
            </div>
          </div>
        ))
      )}
    </MainContainer>
  );
};

export default CustomerList;
