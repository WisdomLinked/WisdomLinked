import { describe, expect, it } from 'vitest';
import { isSavedFreeSeminar } from './seminarFree';

describe('isSavedFreeSeminar', () => {
  it('treats a published seminar saved at price 0 as free', () => {
    expect(isSavedFreeSeminar({ price: 0, status: 'active' })).toBe(true);
  });

  it('treats a price-0 seminar with any non-draft status as free', () => {
    expect(isSavedFreeSeminar({ price: 0, status: 'pending' })).toBe(true);
    expect(isSavedFreeSeminar({ price: 0 })).toBe(true);
  });

  it('accepts a price that arrives as a string', () => {
    expect(isSavedFreeSeminar({ price: '0', status: 'active' })).toBe(true);
  });

  it('does not treat a paid seminar as free', () => {
    expect(isSavedFreeSeminar({ price: 25, status: 'active' })).toBe(false);
    expect(isSavedFreeSeminar({ price: 0.5, status: 'active' })).toBe(false);
  });

  it('never treats a draft as free, even at price 0', () => {
    expect(isSavedFreeSeminar({ price: 0, status: 'draft' })).toBe(false);
  });

  it('does not treat a missing or blank price as free', () => {
    expect(isSavedFreeSeminar({ status: 'active' })).toBe(false);
    expect(isSavedFreeSeminar({ price: null, status: 'active' })).toBe(false);
    expect(isSavedFreeSeminar({ price: '', status: 'active' })).toBe(false);
    expect(isSavedFreeSeminar({ price: '  ', status: 'active' })).toBe(false);
  });
});
