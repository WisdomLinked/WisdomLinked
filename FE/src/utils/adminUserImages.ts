export type HydratableUser = {
  _id?: string;
  email?: string;
  image?: any;
};

export function userImageKey(user: HydratableUser | null | undefined): string {
  if (!user) return '';
  return String(user._id || user.email || '');
}

export function usersAwaitingImages<T extends HydratableUser>(
  users: T[] | null | undefined,
): T[] {
  if (!Array.isArray(users)) return [];
  return users.map((user) => (user && user.image ? { ...user, image: null } : user));
}

export function applyUserImage<T extends HydratableUser>(
  users: T[] | null | undefined,
  key: string,
  image: string | null | undefined,
): T[] {
  if (!Array.isArray(users)) return [];
  if (!key || !image) return users;

  let matched = false;
  const next = users.map((user) => {
    if (userImageKey(user) !== key) return user;
    matched = true;
    return { ...user, image };
  });

  return matched ? next : users;
}
