import { useAppSelector } from '../store';
import { isAccountUnderReview } from '../utils/accountStatus';

export function useAccountUnderReview(): boolean {
  const status = useAppSelector(state => state.auth?.userDetails?.status);
  return isAccountUnderReview(status);
}
