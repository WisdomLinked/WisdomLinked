import { describe, expect, it } from 'vitest';
import { formatProfileLocation, placeName } from './profileLocation';

describe('placeName', () => {
  it('reads strings and {name|label|value} objects', () => {
    expect(placeName(' China ')).toBe('China');
    expect(placeName({ name: 'Korea' })).toBe('Korea');
    expect(placeName({ label: 'Mexico' })).toBe('Mexico');
    expect(placeName(null)).toBe('');
  });
});

describe('formatProfileLocation', () => {
  it('joins city, state, and country when present', () => {
    expect(
      formatProfileLocation({
        city: { name: 'Austin' },
        state: { name: 'Texas' },
        country: { name: 'United States' },
      }),
    ).toBe('Austin, Texas, United States');
  });

  it('skips empty parts and accepts a string country', () => {
    expect(formatProfileLocation({ country: 'China' })).toBe('China');
    expect(formatProfileLocation({ city: 'Shanghai', country: { name: 'China' } })).toBe(
      'Shanghai, China',
    );
    expect(formatProfileLocation({})).toBe('');
  });
});
