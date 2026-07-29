import { describe, expect, it } from 'vitest';
import {
  sanitizePendingDetails,
  stripSensitiveFields,
  persistUserDetails,
  persistPendingDetails,
} from './safeLocalStorage';

const memoryStorage = (): Storage => {
  const store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {},
  } as Storage;
};

describe('stripSensitiveFields', () => {
  it('drops credential-ish keys at the top level', () => {
    const out = stripSensitiveFields({
      _id: 'u1',
      email: 'a@b.com',
      token: 'jwt-value',
      password: 'hunter2',
      refreshToken: 'r',
    });
    expect(out).toEqual({ _id: 'u1', email: 'a@b.com' });
  });

  it('drops them from nested objects and arrays too', () => {
    const out = stripSensitiveFields({
      name: 'x',
      session: { jwt: 'a', keep: 1 },
      list: [{ secret: 's', id: 2 }],
    });
    expect(out).toEqual({ name: 'x', session: { keep: 1 }, list: [{ id: 2 }] });
  });

  it('is case-insensitive but does not drop unrelated keys', () => {
    const out = stripSensitiveFields({ Token: 1, tokenCount: 2, authorId: 3 });
    expect(out).toEqual({ tokenCount: 2, authorId: 3 });
  });

  it('passes through primitives and null', () => {
    expect(stripSensitiveFields('x')).toBe('x');
    expect(stripSensitiveFields(null)).toBe(null);
  });
});

describe('sanitizePendingDetails', () => {
  it('keeps every field the redirect-recovery flow reads', () => {
    const out = sanitizePendingDetails({
      kind: 'accept-1to1',
      groupChatId: 'g1',
      requiresApproval: true,
      expert: 'e1',
      name: 'Session',
      description: 'note',
      services: ['Advising'],
      purposeOther: 'other',
      start: '2026-06-15T14:00:00.000Z',
      end: '2026-06-15T15:00:00.000Z',
      duration: 60,
      price: 60,
    });
    expect(out).toEqual({
      kind: 'accept-1to1',
      groupChatId: 'g1',
      requiresApproval: true,
      expert: 'e1',
      name: 'Session',
      description: 'note',
      services: ['Advising'],
      purposeOther: 'other',
      start: '2026-06-15T14:00:00.000Z',
      end: '2026-06-15T15:00:00.000Z',
      duration: 60,
      price: 60,
    });
  });

  it('drops anything not on the whitelist', () => {
    const out = sanitizePendingDetails({
      groupChatId: 'g1',
      client_secret: 'pi_secret',
      token: 'jwt',
      userDetails: { email: 'a@b.com' },
    });
    expect(out).toEqual({ groupChatId: 'g1' });
  });

  it('coerces ids to strings and numbers to numbers', () => {
    const out = sanitizePendingDetails({ expert: { toString: () => 'e9' }, duration: '60', price: '12.5' });
    expect(out.expert).toBe('e9');
    expect(out.duration).toBe(60);
    expect(out.price).toBe(12.5);
  });

  it('omits non-finite numbers rather than storing NaN', () => {
    expect(sanitizePendingDetails({ duration: 'abc' }).duration).toBeUndefined();
  });

  it('returns an empty object for null input', () => {
    expect(sanitizePendingDetails(null)).toEqual({});
  });
});

describe('persist helpers', () => {
  it('persistUserDetails writes stripped JSON', () => {
    const s = memoryStorage();
    persistUserDetails(s, 'currentUser', { _id: 'u1', token: 'jwt' });
    expect(JSON.parse(s.getItem('currentUser') as string)).toEqual({ _id: 'u1' });
  });

  it('persistPendingDetails writes whitelisted JSON under pendingDetails', () => {
    const s = memoryStorage();
    persistPendingDetails(s, { groupChatId: 'g1', token: 'jwt' });
    expect(JSON.parse(s.getItem('pendingDetails') as string)).toEqual({ groupChatId: 'g1' });
  });
});
