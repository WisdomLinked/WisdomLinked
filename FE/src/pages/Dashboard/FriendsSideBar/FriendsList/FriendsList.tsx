// import React from "react";
// import {styled} from "@mui/system";
// import FriendsListItem from "./FriendsListItem";
// import {useAppSelector} from "../../../../store";
// import {profileImageFetch} from "../../../../api/api";
//
// const DUMMY_FRIENDS = [
//   {
//     id: "1",
//     username: "Mark",
//     isOnline: true,
//   },
//   {
//     id: "2",
//     username: "Anna",
//     isOnline: false,
//   },
//   {
//     id: "3",
//     username: "John",
//     isOnline: false,
//   },
// ];
//
// const MainContainer = styled("div")({
//   flexGrow: 1,
//   width: "100%",
//   margin: "20px 0"
// });
//
// const FriendsList = () => {
//   const { friends, onlineUsers } = useAppSelector(state => state.friends);
//
//   // const modifiedFriends = friends.map(friend => {
//   //   const isOnline = onlineUsers.find(user => user.userId === friend.id);
//   //
//   //   return { ...friend, isOnline: !!isOnline };
//   // })
//   const updateFriendsWithImages = async (friends: any[], onlineUsers: any[]) => {
//     try {
//       // Fetch and update images for all friends
//       return await Promise.all(
//           friends.map(async (friend) => {
//             const isOnline = onlineUsers.find(user => user.userId === friend.id);
//             let base64Image = "";
//
//             if (friend.image) {
//               try {
//                 base64Image = await profileImageFetch(friend.image,"small");
//               } catch (error) {
//                 console.error(`Error fetching image for friend ${friend.id}:`, error);
//               }
//             }
//
//             return {
//               ...friend,
//               isOnline: !!isOnline,
//               image: base64Image, // Update the .image property with Base64
//             };
//           })
//       );
//     } catch (error) {
//       console.error("Error updating friends with images:", error);
//       return friends; // Return original friends if something goes wrong
//     }
//   };
//
//   const modifiedFriends= await updateFriendsWithImages(friends,onlineUsers)
//
//   return (
//     <MainContainer>
//       {modifiedFriends.map((f) => (
//         <FriendsListItem
//           username={f.username}
//           status={f.status}
//           id={f.id}
//           key={f.id}
//           isOnline={f.isOnline}
//           email={f.email}
//           image={f.image}
//           lastChatDate={f.lastChatDate}
//           missedChats={f.missedChats}
//         />
//       ))}
//     </MainContainer>
//   );
// };
//
// export default FriendsList;
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

const FriendsList = () => {
  const { friends, onlineUsers } = useAppSelector((state) => state.friends);

  const [modifiedFriends, setModifiedFriends] = useState<any[]>([]);

  // Function to fetch and update friends with images
  const updateFriendsWithImages = async (friends: any[], onlineUsers: any[]) => {
    try {
      return await Promise.all(
          friends.map(async (friend) => {
            const isOnline = onlineUsers.find((user) => user.userId === friend.id);
            let base64Image = "";

            if (friend.image) {
              try {
                base64Image = await profileImageFetch(friend.image, "small");
              } catch (error) {
                console.error(`Error fetching image for friend ${friend.id}:`, error);
              }
            }

            return {
              ...friend,
              isOnline: !!isOnline,
              image: base64Image, // Update the .image property with Base64
            };
          })
      );
    } catch (error) {
      console.error("Error updating friends with images:", error);
      return friends; // Return original friends if something goes wrong
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

  return (
      <MainContainer>
        {modifiedFriends.map((f) => (
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

