import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';

export function dashboardPathForRole(role: unknown): string {
  if (role === 'expert') return '/user/expertdashboard';
  if (role === 'admin') return '/user/admindashboard';
  return '/user/studentdashboard';
}

const noSubscription = () => () => {};

export function useSignedInRole(): string | null {
  const store = useContext(ReactReduxContext)?.store;
  const user = useSyncExternalStore(
    store ? store.subscribe : noSubscription,
    () => (store ? (store.getState() as any)?.auth?.userDetails : null),
  );
  return user?.email ? String(user.role || 'customer') : null;
}
