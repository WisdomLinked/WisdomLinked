import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../../../store';
import { getRequiredContracts } from '../../../api/termsApi';
import TermsSignDialog from '../../terms/TermsSignDialog';
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
    description: 'Degree, intake, school, GPA, targets, and country (from Location).',
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
  terms: {
    description: 'Sign the current student agreement.',
    actionLabel: 'Sign',
  },
};

type Props = {
  onOpenSection: (href: string) => void;
};

export default function StudentProfileCompletionCard({ onOpenSection }: Props) {
  const userDetails = useAppSelector((s: { auth?: { userDetails?: Record<string, unknown> | null } }) =>
    s.auth?.userDetails,
  );
  const [hydrated, setHydrated] = useState(false);
  const [roleTermsSigned, setRoleTermsSigned] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRequiredContracts()
      .then((contracts) => {
        if (cancelled) return;
        setRoleTermsSigned(!contracts.some((contract) => contract.audience === 'customer'));
      })
      .catch(() => {
        if (!cancelled) setRoleTermsSigned(false);
      });
    return () => {
      cancelled = true;
    };
  }, [termsOpen]);

  const completion = useMemo(
    () => (userDetails ? getStudentProfileCompletion({ ...userDetails, roleTermsSigned }) : null),
    [userDetails, roleTermsSigned],
  );

  // Brief skeleton before the first paint settles; hide entirely if auth never arrives.
  if (!hydrated || userDetails === undefined) {
    return <ProfileCompletionCardSkeleton />;
  }
  if (!userDetails || !completion) return null;

  // Match the expert setup card: disappear as soon as every section is done.
  if (completion.percent >= 100) return null;

  const sections: ProfileCompletionSectionView[] = completion.sections.map((section) => {
    const copy = SECTION_COPY[section.id];
    const partial =
      section.filled > 0 && !section.isComplete
        ? `${section.filled} of ${section.total}`
        : undefined;
    return {
      ...section,
      description: copy.description,
      actionLabel: copy.actionLabel,
      reviewLabel: section.id === 'terms' ? 'View' : undefined,
      progressBadge: partial,
    };
  });

  return (
    <>
    <ProfileCompletionCard
      eyebrow="Finish your student profile"
      title="Complete your profile"
      helperText="Experts use this to prepare for your sessions, so you don't repeat yourself each time."
      percent={completion.percent}
      sections={sections}
      onSectionAction={(href) => {
        if (href === '#terms-agreement') {
          setTermsOpen(true);
          return;
        }
        onOpenSection(href);
      }}
    />
    {termsOpen ? (
      <TermsSignDialog
        open
        role="customer"
        onClose={() => setTermsOpen(false)}
        onSigned={() => setRoleTermsSigned(true)}
      />
    ) : null}
    </>
  );
}
