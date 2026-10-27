export type AgreementKey = 'shared' | 'expert' | 'student';
export type UserRole = 'expert' | 'student';
export type SignatureTone = 'current' | 'outdated' | 'missing';

export type AgreementVersion = {
  number: number;
  publishedAt: string;
  publishedBy: string;
  accepted: number;
  notes: string;
};

export type AgreementContract = {
  key: AgreementKey;
  label: string;
  audienceLabel: string;
  audience: number;
  versions: AgreementVersion[];
};

export type UserSignature = {
  agreement: AgreementKey;
  version: number;
  signedAt: string;
};

export type TermsUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  signatures: UserSignature[];
};

export const AGREEMENT_KEYS: AgreementKey[] = ['shared', 'expert', 'student'];

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCX_BYTES = 10 * 1024 * 1024;

const CONTRACTS: AgreementContract[] = [
  {
    key: 'shared',
    label: 'Shared',
    audienceLabel: 'Every student and expert',
    audience: 1284,
    versions: [
      {
        number: 4,
        publishedAt: '2026-10-23T00:41:00-05:00',
        publishedBy: 'Jordan Ellis',
        accepted: 1102,
        notes: 'Clarified refund window for cancelled sessions',
      },
      {
        number: 3,
        publishedAt: '2026-07-12T15:18:00-05:00',
        publishedBy: 'Jordan Ellis',
        accepted: 1240,
        notes: 'Updated seminar waitlist and seat request language',
      },
      {
        number: 2,
        publishedAt: '2026-02-04T09:05:00-05:00',
        publishedBy: 'Priya Raman',
        accepted: 1188,
        notes: 'Added payment authorization hold disclosure',
      },
      {
        number: 1,
        publishedAt: '2025-11-18T16:22:00-05:00',
        publishedBy: 'Priya Raman',
        accepted: 980,
        notes: 'Initial shared marketplace terms',
      },
    ],
  },
  {
    key: 'expert',
    label: 'Expert',
    audienceLabel: 'Experts only',
    audience: 318,
    versions: [
      {
        number: 3,
        publishedAt: '2026-10-08T11:02:00-05:00',
        publishedBy: 'Jordan Ellis',
        accepted: 241,
        notes: 'Clarified expert payout timing and dispute window',
      },
      {
        number: 2,
        publishedAt: '2026-05-21T14:40:00-05:00',
        publishedBy: 'Priya Raman',
        accepted: 310,
        notes: 'Added seminar hosting and capacity rules',
      },
      {
        number: 1,
        publishedAt: '2026-01-09T10:15:00-05:00',
        publishedBy: 'Priya Raman',
        accepted: 280,
        notes: 'Initial expert agreement',
      },
    ],
  },
  {
    key: 'student',
    label: 'Student',
    audienceLabel: 'Students only',
    audience: 966,
    versions: [
      {
        number: 2,
        publishedAt: '2026-09-30T08:20:00-05:00',
        publishedBy: 'Jordan Ellis',
        accepted: 802,
        notes: 'Clarified student cancellation and no-show policy',
      },
      {
        number: 1,
        publishedAt: '2026-01-09T10:16:00-05:00',
        publishedBy: 'Priya Raman',
        accepted: 900,
        notes: 'Initial student agreement',
      },
    ],
  },
];

export const MOCK_USERS: TermsUser[] = [
  {
    id: 'u1',
    name: 'Maya Chen',
    username: 'maya.chen',
    email: 'maya.chen@wisdomlinked.test',
    role: 'expert',
    signatures: [
      { agreement: 'shared', version: 4, signedAt: '2026-10-23T09:12:00-05:00' },
      { agreement: 'expert', version: 3, signedAt: '2026-10-09T16:04:00-05:00' },
    ],
  },
  {
    id: 'u2',
    name: 'Jordan Hale',
    username: 'jordan.hale',
    email: 'jordan.hale@wisdomlinked.test',
    role: 'student',
    signatures: [
      { agreement: 'shared', version: 3, signedAt: '2026-07-14T11:27:00-05:00' },
      { agreement: 'student', version: 2, signedAt: '2026-10-01T08:44:00-05:00' },
    ],
  },
  {
    id: 'u3',
    name: 'Priya Shah',
    username: 'priya.shah',
    email: 'priya.shah@wisdomlinked.test',
    role: 'expert',
    signatures: [{ agreement: 'shared', version: 4, signedAt: '2026-10-24T13:08:00-05:00' }],
  },
  {
    id: 'u4',
    name: 'Sam Okonkwo',
    username: 'sam.okonkwo',
    email: 'sam.okonkwo@wisdomlinked.test',
    role: 'student',
    signatures: [],
  },
];

export function initialContracts(): AgreementContract[] {
  return structuredClone(CONTRACTS);
}

export function termsUrls(key: AgreementKey, version: number) {
  const base = `/api/terms/${key}/${version}`;
  return {
    html: `${base}/html`,
    docx: `${base}/docx`,
    signers: `${base}/signers`,
  };
}

export function currentVersion(contract: AgreementContract): AgreementVersion {
  return contract.versions[0];
}

export function nextVersionNumber(contract: AgreementContract): number {
  return currentVersion(contract).number + 1;
}

export function requiredAgreements(role: UserRole): AgreementKey[] {
  return role === 'expert' ? ['shared', 'expert'] : ['shared', 'student'];
}

export function signatureFor(user: TermsUser, key: AgreementKey): UserSignature | undefined {
  return user.signatures.find(item => item.agreement === key);
}

export function signatureTone(
  user: TermsUser,
  key: AgreementKey,
  current: number,
): SignatureTone {
  const signed = signatureFor(user, key);
  if (!signed) return 'missing';
  if (signed.version === current) return 'current';
  return 'outdated';
}

export function searchUsers(query: string, users: TermsUser[] = MOCK_USERS): TermsUser[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return users.filter(user => {
    return (
      user.name.toLowerCase().includes(needle) ||
      user.username.toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle)
    );
  });
}

export function formatTermsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function acceptanceRate(accepted: number, audience: number): number {
  if (audience <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((accepted / audience) * 100)));
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';
export const CARD = 'rounded-xl border border-slate-200 bg-white';
