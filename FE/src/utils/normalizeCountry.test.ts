import { describe, expect, it } from 'vitest';
import { normalizeCountry } from './normalizeCountry';

describe('normalizeCountry', () => {
  it('treats placeholders as missing and merges USA aliases', () => {
    expect(normalizeCountry('')).toBeNull();
    expect(normalizeCountry('n/a')).toBeNull();
    expect(normalizeCountry('USA')).toBe('United States');
    expect(normalizeCountry({ name: 'us' })).toBe('United States');
    expect(normalizeCountry({ name: 'Canada' })).toBe('Canada');
  });
});
