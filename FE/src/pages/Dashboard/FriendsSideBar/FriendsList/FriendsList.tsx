import React, { useEffect, useState } from "react";
import { styled } from "@mui/system";
import FriendsListItem from "./FriendsListItem";
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

const FriendsList = () => {
  const { friends, onlineUsers } = useAppSelector((state) => state.friends);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredFriends = friends
    .map((friend) => ({
      ...friend,
      isOnline: onlineUsers.some((user) => user.userId === friend.id),
    }))
    .filter((friend) =>
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <MainContainer>
      <SearchInput
        type="text"
        placeholder="Search by username..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {filteredFriends.map((f) => (
        <FriendsListItem
          key={f.id}
          id={f.id}
          username={f.username}
          email={f.email}
          status={f.status}
          isOnline={f.isOnline}
          image={f.profileImageUrl}
          lastChatDate={f.lastChatDate}
          missedChats={f.missedChats}
        />
      ))}
    </MainContainer>
  );
};

export default FriendsList;