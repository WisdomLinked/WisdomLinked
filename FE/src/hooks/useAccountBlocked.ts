import { useAppSelector } from '../store';
import { isAccountBlocked } from '../utils/accountStatus';

export function useAccountBlocked(): boolean {
  const status = useAppSelector(state => state.auth?.userDetails?.status);
  return isAccountBlocked(status);
}
