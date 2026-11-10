import { describe, expect, it } from 'vitest';
import {
  API_AUDIENCE,
  acceptanceRate,
  contractFromOverview,
  currentVersion,
  formatTermsDate,
  initialContracts,
  initialsFromName,
  nextVersionNumber,
  requiredAgreements,
  agreementKeyFromAudience,
  agreementStanding,
  displayName,
  roleLabel,
  standingLabel,
  standingTone,
  type AgreementContract,
} from './termsModel';
import type { TermsUserHit } from '../../../../api/termsApi';

describe('termsModel', () => {
  it('maps the student tab to the backend customer audience', () => {
    expect(API_AUDIENCE).toEqual({ shared: 'shared', expert: 'expert', student: 'customer' });
  });

  it('starts every contract loading with no versions', () => {
    const contracts = initialContracts();
    expect(contracts.map(item => [item.key, item.status, item.versions.length, item.audience])).toEqual([
      ['shared', 'loading', 0, 0],
      ['expert', 'loading', 0, 0],
      ['student', 'loading', 0, 0],
    ]);
  });

  it('builds a contract from the API with the newest version first', () => {
    const [shared] = initialContracts();
    const contract = contractFromOverview(shared, {
      audience: 'shared',
      audienceSize: 25,
      versions: [
        {
          audience: 'shared',
          version: 1,
          contentHash: 'a',
          originalFilename: 'v1.docx',
          publishedAt: '2026-10-01T10:00:00Z',
          publisherName: 'admin',
          accepted: 20,
          notes: '  First  ',
        },
        {
          audience: 'shared',
          version: 2,
          contentHash: 'b',
          originalFilename: 'v2.docx',
          publishedAt: '2026-10-20T10:00:00Z',
          accepted: 7,
        },
      ],
    });
    expect(contract.status).toBe('ready');
    expect(contract.audience).toBe(25);
    expect(contract.versions.map(item => item.number)).toEqual([2, 1]);
    expect(currentVersion(contract)).toEqual({
      number: 2,
      publishedAt: '2026-10-20T10:00:00Z',
      publishedBy: 'Admin',
      accepted: 7,
      notes: '',
      originalFilename: 'v2.docx',
    });
    expect(contract.versions[1].publishedBy).toBe('admin');
    expect(contract.versions[1].notes).toBe('First');
    expect(nextVersionNumber(contract)).toBe(3);
  });

  it('treats missing counts as zero and an empty history as no current version', () => {
    const [, expert] = initialContracts();
    const contract = contractFromOverview(expert, { audience: 'expert', audienceSize: Number.NaN, versions: [] });
    expect(contract.status).toBe('ready');
    expect(contract.audience).toBe(0);
    expect(currentVersion(contract)).toBeUndefined();
    expect(nextVersionNumber(contract)).toBe(1);
  });

  it('formats dates with month, day, year and time', () => {
    expect(formatTermsDate('2026-10-23T00:41:00-05:00')).toMatch(/Oct 23, 2026/);
  });

  it('returns the contracts an account must sign; admins sign none', () => {
    expect(requiredAgreements('expert')).toEqual(['shared', 'expert']);
    expect(requiredAgreements('customer')).toEqual(['shared', 'student']);
    expect(requiredAgreements('admin')).toEqual([]);
    expect(requiredAgreements('')).toEqual([]);
  });

  it('maps backend audiences and roles to the labels admins see', () => {
    expect(agreementKeyFromAudience('customer')).toBe('student');
    expect(agreementKeyFromAudience('shared')).toBe('shared');
    expect(agreementKeyFromAudience('nonsense')).toBeNull();
    expect(roleLabel('customer')).toBe('student');
    expect(roleLabel('expert')).toBe('expert');
    expect(displayName({ name: '', username: 'ada', email: 'a@x.com' })).toBe('ada');
    expect(displayName({ name: '', username: '', email: 'a@x.com' })).toBe('a@x.com');
  });

  describe('agreementStanding', () => {
    const contract = (versions: number[], status: AgreementContract['status'] = 'ready'): AgreementContract => ({
      ...initialContracts()[2],
      status,
      versions: versions.map(number => ({
        number,
        publishedAt: '2026-10-01T10:00:00Z',
        publishedBy: 'Admin',
        accepted: 0,
        notes: '',
        originalFilename: '',
      })),
    });
    const user = (signatures: TermsUserHit['signatures']): TermsUserHit => ({
      id: 'u', email: 'u@x.com', username: 'u', name: '', role: 'customer', signatures,
    });
    const student = (version: number) => [{ audience: 'customer' as const, version, signedAt: '2026-10-09T10:00:00Z' }];

    it('is current when the newest version is signed (matched on the customer audience)', () => {
      const standing = agreementStanding(user(student(2)), contract([2, 1]));
      expect(standing).toEqual({ tone: 'current', signedVersion: 2, signedAt: '2026-10-09T10:00:00Z' });
      expect(standingTone(standing)).toBe('current');
      expect(standingLabel('student', standing)).toMatch(/^Student: signed v2 on Oct 9, 2026/);
    });

    it('needs an update when only an older version is signed', () => {
      const standing = agreementStanding(user(student(1)), contract([3, 2, 1]));
      expect(standing).toEqual({ tone: 'outdated', signedVersion: 1, currentVersion: 3 });
      expect(standingLabel('student', standing)).toBe('Student: signed v1, needs v3');
    });

    it('is not signed when there is no signature for that contract', () => {
      const other = [{ audience: 'shared' as const, version: 2, signedAt: '2026-10-09T10:00:00Z' }];
      expect(agreementStanding(user(other), contract([2]))).toEqual({ tone: 'missing', currentVersion: 2 });
      expect(agreementStanding(user(undefined), contract([2])).tone).toBe('missing');
      expect(standingLabel('student', { tone: 'missing', currentVersion: 2 })).toBe('Student: not signed');
    });

    it('says nothing is published, or that the status is unavailable, instead of guessing', () => {
      const unpublished = agreementStanding(user(student(1)), contract([]));
      expect(unpublished).toEqual({ tone: 'unpublished' });
      expect(standingTone(unpublished)).toBe('neutral');
      expect(standingLabel('student', unpublished)).toBe('Student: nothing published yet');
      for (const status of ['loading', 'error'] as const) {
        const unknown = agreementStanding(user(student(1)), contract([1], status));
        expect(unknown).toEqual({ tone: 'unknown' });
        expect(standingLabel('student', unknown)).toBe('Student: status unavailable');
      }
    });
  });

  it('rounds acceptance and builds initials', () => {
    expect(acceptanceRate(1102, 1284)).toBe(86);
    expect(initialsFromName('Maya Chen')).toBe('MC');
  });
});
