export const buildFallbackChatProfile = (chosenChatDetails: any, myRole: string) => {
  const me = String(myRole || "").toLowerCase();
  const inferredOtherRole = me === "expert" ? "customer" : me === "customer" ? "expert" : "member";
  return {
    _id: String(chosenChatDetails?.userId || ""),
    username: String(chosenChatDetails?.username || "Member"),
    email: "",
    image: chosenChatDetails?.image || null,
    role: inferredOtherRole,
    country: null,
    keywords: [],
    services: [],
  };
};

export const mergeChatProfile = (fallbackProfile: any, apiProfile: any) => {
  if (!apiProfile || typeof apiProfile !== "object") return fallbackProfile;
  return {
    ...fallbackProfile,
    ...apiProfile,
    username: String(apiProfile?.username || fallbackProfile?.username || "Member"),
    role: String(apiProfile?.role || fallbackProfile?.role || "member"),
  };
};

