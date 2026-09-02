export const buildOnlineUserIdSet = (onlineUsers: any): Set<string> => {
  const ids = new Set<string>();
  if (!Array.isArray(onlineUsers)) return ids;
  onlineUsers.forEach((user: any) => {
    [user?.userId, user?.id, user?._id, user?.user?._id, user?.user?.id].forEach((v: any) => {
      const s = String(v ?? "").trim();
      if (s) ids.add(s);
    });
  });
  return ids;
};

export const hasOnlineUserId = (onlineIdSet: Set<string>, userId: unknown): boolean => {
  const id = String(userId ?? "").trim();
  return !!id && onlineIdSet.has(id);
};

