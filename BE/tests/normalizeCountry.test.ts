import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCountryRaw, isUnitedStates, normalizeCountry } from '../utils/normalizeCountry';

describe('normalizeCountry', () => {
    it('returns null for missing and placeholder values', () => {
        assert.equal(normalizeCountry(null), null);
        assert.equal(normalizeCountry(undefined), null);
        assert.equal(normalizeCountry(''), null);
        assert.equal(normalizeCountry('   '), null);
        assert.equal(normalizeCountry('n/a'), null);
        assert.equal(normalizeCountry('Unknown'), null);
        assert.equal(normalizeCountry({ name: '  ' }), null);
        assert.equal(normalizeCountry({ name: 'Select Country' }), null);
    });

    it('merges USA variants into United States', () => {
        for (const raw of ['USA', 'US', 'U.S.', 'U.S.A.', 'united states', 'United States of America']) {
            assert.equal(normalizeCountry(raw), 'United States', raw);
        }
        assert.equal(normalizeCountry({ name: 'usa', isoCode: 'US' }), 'United States');
        assert.ok(isUnitedStates(normalizeCountry('US')));
    });

    it('reads ICountry-shaped objects and legacy strings', () => {
        assert.equal(extractCountryRaw({ name: 'Canada', isoCode: 'CA' }), 'Canada');
        assert.equal(normalizeCountry({ name: 'Canada' }), 'Canada');
        assert.equal(normalizeCountry('canada'), 'Canada');
        assert.equal(normalizeCountry({ isoCode: 'GB' }), 'United Kingdom');
    });
});
