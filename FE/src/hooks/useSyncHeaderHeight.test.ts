import { describe, expect, it, afterEach } from 'vitest';
import { HEADER_HEIGHT_VAR } from '../types/alert';
import { HEADER_HEIGHT_FALLBACK_PX, syncHeaderHeight } from './useSyncHeaderHeight';

describe('syncHeaderHeight', () => {
    afterEach(() => {
        document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR);
        document.body.innerHTML = '';
    });

    it('falls back when no header chrome is present', () => {
        const height = syncHeaderHeight();
        expect(height).toBe(HEADER_HEIGHT_FALLBACK_PX);
        expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe(
            `${HEADER_HEIGHT_FALLBACK_PX}px`,
        );
    });

    it('uses the lowest sticky/fixed header bottom without page-title clearance', () => {
        const banner = document.createElement('div');
        banner.setAttribute('data-wl-header', '');
        Object.defineProperty(banner, 'getBoundingClientRect', {
            value: () => ({ top: 0, bottom: 40, height: 40, width: 100, left: 0, right: 100 }),
        });
        const nav = document.createElement('header');
        nav.setAttribute('data-wl-header', '');
        Object.defineProperty(nav, 'getBoundingClientRect', {
            value: () => ({ top: 40, bottom: 96, height: 56, width: 100, left: 0, right: 100 }),
        });
        document.body.append(banner, nav);

        expect(syncHeaderHeight()).toBe(96);
        expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)).toBe('96px');
    });
});
