import { describe, it, expect } from 'vitest';
import { unreadByChatSection } from './chatSectionUnread';

describe('unreadByChatSection', () => {
    it('files a seminar room under seminars', () => {
        const out = unreadByChatSection({ 'rid-s': 3 }, { 'rid-s': 'seminar' });
        expect(out).toEqual({ seminars: 3 });
    });

    it('files a community room under communities', () => {
        const out = unreadByChatSection({ 'rid-c': 2 }, { 'rid-c': 'community' });
        expect(out).toEqual({ communities: 2 });
    });

    it('files a DM under 1:1 appointments, which is where DM rows actually live', () => {
        const out = unreadByChatSection({ 'rid-d': 1 }, { 'rid-d': 'dm' });
        expect(out).toEqual({ appointments: 1 });
    });

    it('never reports a direct section, because that list is still an empty placeholder', () => {
        const out = unreadByChatSection({ 'rid-d': 4 }, { 'rid-d': 'dm' });
        expect(out.direct).toBeUndefined();
    });

    it('adds up several rooms in the same section', () => {
        const out = unreadByChatSection(
            { a: 2, b: 3, c: 5 },
            { a: 'seminar', b: 'seminar', c: 'community' },
        );
        expect(out).toEqual({ seminars: 5, communities: 5 });
    });

    it('keeps the sections summing to the Chat badge total', () => {
        const unread = { a: 2, b: 3, c: 5, d: 1 };
        const targets: Record<string, 'dm' | 'seminar' | 'community'> = {
            a: 'seminar',
            b: 'community',
            c: 'dm',
            d: 'seminar',
        };
        const badgeTotal = Object.values(unread).reduce((sum, n) => sum + n, 0);
        const sectionTotal = Object.values(unreadByChatSection(unread, targets)).reduce(
            (sum, n) => sum + n,
            0,
        );
        expect(sectionTotal).toBe(badgeTotal);
    });

    it('omits a section rather than reporting it as zero', () => {
        const out = unreadByChatSection({ a: 0, b: 2 }, { a: 'seminar', b: 'community' });
        expect(out).toEqual({ communities: 2 });
        expect('seminars' in out).toBe(false);
    });

    it('skips a room no list can open', () => {
        const out = unreadByChatSection({ orphan: 9, b: 1 }, { b: 'seminar' });
        expect(out).toEqual({ seminars: 1 });
    });

    it('ignores counts that are negative, NaN or not numbers at all', () => {
        const out = unreadByChatSection(
            { a: -4, b: Number.NaN, c: 'nope' as unknown as number, d: 2 },
            { a: 'seminar', b: 'seminar', c: 'seminar', d: 'seminar' },
        );
        expect(out).toEqual({ seminars: 2 });
    });

    it('floors a fractional count instead of propagating it to the badge', () => {
        const out = unreadByChatSection({ a: 2.7 }, { a: 'community' });
        expect(out).toEqual({ communities: 2 });
    });

    it('matches a room id that carries stray whitespace', () => {
        const out = unreadByChatSection({ ' rid-s ': 3 }, { 'rid-s': 'seminar' });
        expect(out).toEqual({ seminars: 3 });
    });

    it('returns nothing for empty, null or undefined input', () => {
        expect(unreadByChatSection({}, {})).toEqual({});
        expect(unreadByChatSection(null, null)).toEqual({});
        expect(unreadByChatSection(undefined, undefined)).toEqual({});
        expect(unreadByChatSection({ a: 3 }, null)).toEqual({});
    });
});
