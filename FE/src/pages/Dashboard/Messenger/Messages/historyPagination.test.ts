import { describe, expect, it } from 'vitest';
import {
    isNearBottom,
    preservedScrollTopAfterPrepend,
    scrollContainerToBottom,
    shouldAutoScrollOnAppend,
    shouldRequestOlderMessages,
} from './historyPagination';

describe('historyPagination', () => {
    it('requests older messages when near top and content is scrollable', () => {
        expect(shouldRequestOlderMessages(0, 2000, 600)).toBe(true);
        expect(shouldRequestOlderMessages(10, 2000, 600)).toBe(true);
        expect(shouldRequestOlderMessages(24, 2000, 600)).toBe(true);
    });

    it('does not request older messages when not near top', () => {
        expect(shouldRequestOlderMessages(25, 2000, 600)).toBe(false);
        expect(shouldRequestOlderMessages(200, 2000, 600)).toBe(false);
    });

    it('does not request older messages when list is not scrollable', () => {
        expect(shouldRequestOlderMessages(0, 600, 600)).toBe(false);
        expect(shouldRequestOlderMessages(0, 400, 600)).toBe(false);
    });

    it('preserves visible anchor after prepending history', () => {
        expect(preservedScrollTopAfterPrepend(1000, 1400, 0)).toBe(400);
        expect(preservedScrollTopAfterPrepend(1000, 1400, 20)).toBe(420);
    });

    it('never returns a negative preserved scroll value', () => {
        expect(preservedScrollTopAfterPrepend(1400, 1000, 0)).toBe(0);
    });

    it('detects near bottom within threshold', () => {
        expect(isNearBottom(1320, 2000, 600)).toBe(true);
        expect(isNearBottom(1200, 2000, 600)).toBe(false);
        expect(isNearBottom(0, 400, 600)).toBe(true);
    });

    it('shouldAutoScrollOnAppend skips prepend and respects near bottom / outgoing', () => {
        expect(
            shouldAutoScrollOnAppend({
                prevLength: 10,
                nextLength: 20,
                isPrepending: true,
                nearBottom: true,
                lastMessageOutgoing: true,
            }),
        ).toBe(false);

        expect(
            shouldAutoScrollOnAppend({
                prevLength: 10,
                nextLength: 11,
                isPrepending: false,
                nearBottom: false,
                lastMessageOutgoing: false,
            }),
        ).toBe(false);

        expect(
            shouldAutoScrollOnAppend({
                prevLength: 10,
                nextLength: 11,
                isPrepending: false,
                nearBottom: true,
                lastMessageOutgoing: false,
            }),
        ).toBe(true);

        expect(
            shouldAutoScrollOnAppend({
                prevLength: 10,
                nextLength: 11,
                isPrepending: false,
                nearBottom: false,
                lastMessageOutgoing: true,
            }),
        ).toBe(true);
    });

    it('scrollContainerToBottom sets scrollTop to scrollHeight', () => {
        const el = document.createElement('div');
        Object.defineProperty(el, 'scrollHeight', { value: 900, configurable: true });
        scrollContainerToBottom(el, 'auto');
        expect(el.scrollTop).toBe(900);
    });
});
