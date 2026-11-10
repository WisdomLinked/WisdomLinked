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

// A saved profile comes back from the server with `image` as the stored filename, which the
// avatar cannot display, and without the sign-in lock, which lives elsewhere. Keep both from
// the row already on screen.
export function mergeSavedUser<T extends HydratableUser & { loginLock?: any }>(
  users: T[] | null | undefined,
  saved: T | null | undefined,
): T[] {
  if (!Array.isArray(users)) return [];
  if (!saved?.email) return users;

  let matched = false;
  const next = users.map((user) => {
    if (user?.email !== saved.email) return user;
    matched = true;
    return { ...saved, loginLock: user.loginLock, image: user.image };
  });

  return matched ? next : users;
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
