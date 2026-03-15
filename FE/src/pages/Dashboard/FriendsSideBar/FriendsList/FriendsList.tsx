import React, { useEffect, useState } from "react";
import { styled } from "@mui/system";
import FriendsListItem from "./FriendsListItem";
import { useAppSelector } from "../../../../store";
import { profileImageFetch } from "../../../../api/api";

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
    border: "1px solid #444", // Darker border
    fontSize: "16px",
    backgroundColor: "#222", // Blackish background
    color: "#fff", // White text color for contrast
    outline: "none",
    caretColor: "#00ffff", // Highlighted cursor color to match the theme
    "::placeholder": {
        color: "#888", // Greyish placeholder color
    },
});


const FriendsList = () => {
  const { friends, onlineUsers } = useAppSelector((state) => state.friends);
  const [modifiedFriends, setModifiedFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  
  const updateFriendsWithImages = async (friends: any[], onlineUsers: any[]): Promise<any[]> => {
    try {
      return await Promise.all(
        friends.map(async (friend): Promise<any> => {
          const isOnline = onlineUsers.find((user) => String(user.userId) === String(friend.id ?? friend._id));
          let base64Image: string | null = null;
  
          if (friend.image) {
            try {
              // Cast to string if profileImageFetch is not typed correctly yet
              base64Image = (await profileImageFetch(friend.image, "small")) as string;
            } catch (error) {
              console.error(`Error fetching image for friend ${friend.id}:`, error);
            }
          }
  
          return {
            ...friend,
            isOnline: !!isOnline,
            image: base64Image, // string | null
          };
        })
      );
    } catch (error) {
      console.error("Error updating friends with images:", error);
      return friends;
    }
  };

  // useEffect to handle asynchronous data fetching
  useEffect(() => {
    const fetchModifiedFriends = async () => {
      const updatedFriends = await updateFriendsWithImages(friends, onlineUsers);
      setModifiedFriends(updatedFriends);
    };

    fetchModifiedFriends();
  }, [friends, onlineUsers]);

    // Filter friends based on the search query
    const filteredFriends = modifiedFriends.filter((friend) =>
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
                  username={f.username}
                  status={f.status}
                  id={f.id}
                  key={f.id}
                  isOnline={f.isOnline}
                  email={f.email}
                  image={f.image}
                  lastChatDate={f.lastChatDate}
                  missedChats={f.missedChats}
              />
          ))}
      </MainContainer>
  );
};

export default FriendsList;

