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
  searchUsers,
  signatureTone,
  MOCK_USERS,
} from './termsModel';

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

  it('returns the contracts a role must sign', () => {
    expect(requiredAgreements('expert')).toEqual(['shared', 'expert']);
    expect(requiredAgreements('student')).toEqual(['shared', 'student']);
  });

  it('classifies current, outdated and missing signatures', () => {
    const maya = MOCK_USERS[0];
    const jordan = MOCK_USERS[1];
    const sam = MOCK_USERS[3];
    expect(signatureTone(maya, 'shared', 4)).toBe('current');
    expect(signatureTone(jordan, 'shared', 4)).toBe('outdated');
    expect(signatureTone(sam, 'student', 2)).toBe('missing');
  });

  it('searches users by name, username or email', () => {
    expect(searchUsers('maya').map(user => user.id)).toEqual(['u1']);
    expect(searchUsers('jordan.hale').map(user => user.id)).toEqual(['u2']);
    expect(searchUsers('sam.okonkwo@wisdomlinked.test').map(user => user.id)).toEqual(['u4']);
    expect(searchUsers('no-such-user')).toEqual([]);
    expect(searchUsers('   ')).toEqual([]);
  });

  it('rounds acceptance and builds initials', () => {
    expect(acceptanceRate(1102, 1284)).toBe(86);
    expect(initialsFromName('Maya Chen')).toBe('MC');
  });
});
