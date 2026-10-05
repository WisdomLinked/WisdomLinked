import { useAppSelector } from '../../store';
import { GUIDES_CTA } from '../../content/resourcesTimeline';
import {
  hrefForFindExperts,
  loginRedirect,
  siteSearchAudienceForRole,
  studentDashboardPath,
} from '../../utils/siteSearch';

export const GUIDES_PATH = '/resources/guides';

export function useResourceLinks() {
  const userDetails = useAppSelector((state: any) => state.auth?.userDetails);
  const loggedIn = Boolean(userDetails?._id);
  const audience = loggedIn ? siteSearchAudienceForRole(userDetails?.role) : 'public';
  return {
    loggedIn,
    expertHref: hrefForFindExperts(audience, '') ?? studentDashboardPath({ expertsQuery: '' }),
    guidesHref: loggedIn ? GUIDES_PATH : loginRedirect(GUIDES_PATH),
    guidesLabel: loggedIn ? GUIDES_CTA.loggedIn : GUIDES_CTA.loggedOut,
  };
}
