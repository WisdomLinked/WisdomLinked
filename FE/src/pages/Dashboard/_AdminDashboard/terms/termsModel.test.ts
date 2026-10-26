import { describe, expect, it } from 'vitest';
import {
  acceptanceRate,
  formatTermsDate,
  initialsFromName,
  requiredAgreements,
  searchUsers,
  signatureTone,
  termsUrls,
  MOCK_USERS,
} from './termsModel';

describe('termsModel', () => {
  it('builds html, docx and signers links from one helper', () => {
    expect(termsUrls('shared', 4)).toEqual({
      html: '/api/terms/shared/4/html',
      docx: '/api/terms/shared/4/docx',
      signers: '/api/terms/shared/4/signers',
    });
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
