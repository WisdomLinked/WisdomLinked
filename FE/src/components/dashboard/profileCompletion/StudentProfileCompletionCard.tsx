import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../../../store';
import {
  getStudentProfileCompletion,
  type StudentProfileSectionId,
} from '../../../utils/studentProfileCompletion';
import ProfileCompletionCard, {
  ProfileCompletionCardSkeleton,
  type ProfileCompletionSectionView,
} from './ProfileCompletionCard';

const SECTION_COPY: Record<
  StudentProfileSectionId,
  { description: string; actionLabel: string }
> = {
  academic: {
    description: 'Degree, intake, school, GPA, targets, and country.',
    actionLabel: 'Finish section',
  },
  preferences: {
    description: 'Pick the services you need and your fields of interest.',
    actionLabel: 'Add preferences',
  },
  resume: {
    description: 'Upload a PDF or Word resume experts can review.',
    actionLabel: 'Upload resume',
  },
};

function dismissKey(userId: string) {
  return `wl-student-profile-complete-dismissed:${userId}`;
}

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(userId)) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(userId: string) {
  try {
    localStorage.setItem(dismissKey(userId), '1');
  } catch {
    // Ignore quota / private-mode failures; the card can reappear this session.
  }
}

type Props = {
  onOpenSection: (href: string) => void;
};

export default function StudentProfileCompletionCard({ onOpenSection }: Props) {
  const userDetails = useAppSelector((s: { auth?: { userDetails?: Record<string, unknown> | null } }) =>
    s.auth?.userDetails,
  );
  const userId = typeof userDetails?._id === 'string' ? userDetails._id : '';
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setDismissed(readDismissed(userId));
  }, [userId]);

  const completion = useMemo(
    () => (userDetails ? getStudentProfileCompletion(userDetails) : null),
    [userDetails],
  );

  const onDismiss = useCallback(() => {
    if (!userId) return;
    writeDismissed(userId);
    setDismissed(true);
  }, [userId]);

  // Brief skeleton before the first paint settles; hide entirely if auth never arrives.
  if (!hydrated || userDetails === undefined) {
    return <ProfileCompletionCardSkeleton />;
  }
  if (!userDetails || !completion) return null;

  const complete = completion.percent >= 100;
  if (complete && (dismissed || readDismissed(userId))) return null;

  const sections: ProfileCompletionSectionView[] = completion.sections.map((section) => {
    const copy = SECTION_COPY[section.id];
    const partial =
      section.id === 'academic' && section.filled > 0 && !section.isComplete
        ? `${section.filled} of ${section.total}`
        : undefined;
    return {
      ...section,
      description: copy.description,
      actionLabel: copy.actionLabel,
      progressBadge: partial,
    };
  });

  return (
    <ProfileCompletionCard
      title={complete ? 'Your profile is complete' : 'Complete your profile'}
      helperText={
        complete
          ? 'Thanks — experts can use this to prepare for your sessions.'
          : "Experts use this to prepare for your sessions, so you don't repeat yourself each time."
      }
      percent={completion.percent}
      sections={sections}
      complete={complete}
      onSectionAction={onOpenSection}
      onDismiss={complete ? onDismiss : undefined}
    />
  );
}
