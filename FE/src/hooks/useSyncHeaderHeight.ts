import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HEADER_HEIGHT_VAR } from '../types/alert';

export const HEADER_SELECTOR = '[data-wl-header]';
/** Fallback when no chrome is mounted yet (~4.5rem navbar). */
export const HEADER_HEIGHT_FALLBACK_PX = 72;

export function syncHeaderHeight() {
    if (typeof document === 'undefined') return 0;
    let chromeBottom = 0;
    document.querySelectorAll(HEADER_SELECTOR).forEach(node => {
        const rect = (node as HTMLElement).getBoundingClientRect();
        if (rect.height <= 0) return;
        if (rect.bottom > chromeBottom) chromeBottom = rect.bottom;
    });
    const height = Math.max(Math.ceil(chromeBottom), HEADER_HEIGHT_FALLBACK_PX);
    document.documentElement.style.setProperty(HEADER_HEIGHT_VAR, `${height}px`);
    return height;
}

export function useSyncHeaderHeight() {
    const { pathname } = useLocation();

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            syncHeaderHeight();
        });

        const observeMounted = () => {
            document.querySelectorAll(HEADER_SELECTOR).forEach(el => observer.observe(el));
            syncHeaderHeight();
        };

        const frame = window.requestAnimationFrame(observeMounted);
        const mutations = new MutationObserver(records => {
            for (const record of records) {
                for (const node of [...record.addedNodes, ...record.removedNodes]) {
                    if (node.nodeType !== 1) continue;
                    const el = node as Element;
                    if (el.matches?.(HEADER_SELECTOR) || el.querySelector?.(HEADER_SELECTOR)) {
                        observeMounted();
                        return;
                    }
                }
            }
        });
        mutations.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', syncHeaderHeight);
        window.addEventListener('wl-announcement-change', syncHeaderHeight);

        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
            mutations.disconnect();
            window.removeEventListener('resize', syncHeaderHeight);
            window.removeEventListener('wl-announcement-change', syncHeaderHeight);
        };
    }, [pathname]);
}
