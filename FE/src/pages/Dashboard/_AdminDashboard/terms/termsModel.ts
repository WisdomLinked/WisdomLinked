import type { TermsAudience, TermsOverview, TermsUserHit } from '../../../../api/termsApi';

export type AgreementKey = 'shared' | 'expert' | 'student';
export type SignatureTone = 'current' | 'outdated' | 'missing' | 'neutral';

export type AgreementVersion = {
  number: number;
  publishedAt: string;
  publishedBy: string;
  accepted: number;
  notes: string;
  originalFilename: string;
};

export type ContractStatus = 'loading' | 'ready' | 'error';

export type AgreementContract = {
  key: AgreementKey;
  label: string;
  audienceLabel: string;
  audience: number;
  /** Newest first: versions[0] is the current one. */
  versions: AgreementVersion[];
  status: ContractStatus;
};

export const AGREEMENT_KEYS: AgreementKey[] = ['shared', 'expert', 'student'];

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCX_BYTES = 10 * 1024 * 1024;

/** The backend calls the student contract "customer". */
export const API_AUDIENCE: Record<AgreementKey, TermsAudience> = {
  shared: 'shared',
  expert: 'expert',
  student: 'customer',
};

const CONTRACT_DEFINITIONS: Pick<AgreementContract, 'key' | 'label' | 'audienceLabel'>[] = [
  { key: 'shared', label: 'Shared', audienceLabel: 'Every student and expert' },
  { key: 'expert', label: 'Expert', audienceLabel: 'Experts only' },
  { key: 'student', label: 'Student', audienceLabel: 'Students only' },
];

export function initialContracts(): AgreementContract[] {
  return CONTRACT_DEFINITIONS.map(definition => ({
    ...definition,
    audience: 0,
    versions: [],
    status: 'loading',
  }));
}

export function contractFromOverview(
  contract: AgreementContract,
  overview: TermsOverview,
): AgreementContract {
  const versions = overview.versions
    .map(meta => ({
      number: Number(meta.version),
      publishedAt: meta.publishedAt,
      publishedBy: meta.publisherName || 'Admin',
      accepted: Math.max(0, Number(meta.accepted) || 0),
      notes: (meta.notes || '').trim(),
      originalFilename: meta.originalFilename || '',
    }))
    .filter(version => Number.isInteger(version.number) && version.number > 0)
    .sort((a, b) => b.number - a.number);
  return {
    ...contract,
    audience: Math.max(0, Number(overview.audienceSize) || 0),
    versions,
    status: 'ready',
  };
}

export function currentVersion(contract: AgreementContract): AgreementVersion | undefined {
  return contract.versions[0];
}

export function nextVersionNumber(contract: AgreementContract): number {
  return (currentVersion(contract)?.number ?? 0) + 1;
}

export const AGREEMENT_LABEL: Record<AgreementKey, string> = {
  shared: 'Shared',
  expert: 'Expert',
  student: 'Student',
};

export function agreementKeyFromAudience(audience: TermsAudience | string): AgreementKey | null {
  if (audience === 'shared' || audience === 'expert') return audience;
  if (audience === 'customer') return 'student';
  return null;
}

/** Contracts an account must sign. Admins sign none. Mirrors the backend's listRequiredContracts. */
export function requiredAgreements(role: string): AgreementKey[] {
  if (role === 'expert') return ['shared', 'expert'];
  if (role === 'customer') return ['shared', 'student'];
  return [];
}

export function roleLabel(role: string): string {
  if (role === 'customer') return 'student';
  return role || 'unknown';
}

export function displayName(user: Pick<TermsUserHit, 'name' | 'username' | 'email'>): string {
  return user.name || user.username || user.email || 'Unnamed account';
}

const AUDIENCE_ROLES: Record<AgreementKey, string[]> = {
  shared: ['expert', 'customer'],
  expert: ['expert'],
  student: ['customer'],
};

export type SignerExclusion = 'removed' | 'blocked' | 'role';

/**
 * Why a stored signature is left out of the Accepted count, or null when it counts.
 * Mirrors the backend's audience: students and/or experts whose account is not blocked.
 */
export function signerExclusion(
  key: AgreementKey,
  signer: { role?: string; status?: string },
): SignerExclusion | null {
  if (!signer.role) return 'removed';
  if (!AUDIENCE_ROLES[key].includes(signer.role)) return 'role';
  if (signer.status === 'blocked') return 'blocked';
  return null;
}

export function signerExclusionLabel(reason: SignerExclusion, role?: string): string {
  if (reason === 'removed') return 'Account removed · not counted';
  if (reason === 'blocked') return 'Blocked · not counted';
  return `Now ${roleLabel(role || '')} · not counted`;
}

export type AgreementStanding =
  | { tone: 'current'; signedVersion: number; signedAt: string }
  | { tone: 'outdated'; signedVersion: number; currentVersion: number }
  | { tone: 'missing'; currentVersion: number }
  | { tone: 'unpublished' }
  | { tone: 'unknown' };

/** Where one account stands on one contract, judged against the version that is current now. */
export function agreementStanding(user: TermsUserHit, contract: AgreementContract): AgreementStanding {
  if (contract.status !== 'ready') return { tone: 'unknown' };
  const current = currentVersion(contract);
  if (!current) return { tone: 'unpublished' };
  const signed = (user.signatures || []).find(item => item.audience === API_AUDIENCE[contract.key]);
  const signedVersion = Number(signed?.version);
  if (!signed || !Number.isInteger(signedVersion) || signedVersion < 1) {
    return { tone: 'missing', currentVersion: current.number };
  }
  if (signedVersion >= current.number) return { tone: 'current', signedVersion, signedAt: signed.signedAt };
  return { tone: 'outdated', signedVersion, currentVersion: current.number };
}

export function standingLabel(key: AgreementKey, standing: AgreementStanding): string {
  const label = AGREEMENT_LABEL[key];
  switch (standing.tone) {
    case 'current':
      return `${label}: signed v${standing.signedVersion} on ${formatTermsDate(standing.signedAt)}`;
    case 'outdated':
      return `${label}: signed v${standing.signedVersion}, needs v${standing.currentVersion}`;
    case 'missing':
      return `${label}: not signed`;
    case 'unpublished':
      return `${label}: nothing published yet`;
    default:
      return `${label}: status unavailable`;
  }
}

export function standingTone(standing: AgreementStanding): SignatureTone {
  if (standing.tone === 'current' || standing.tone === 'outdated' || standing.tone === 'missing') return standing.tone;
  return 'neutral';
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
