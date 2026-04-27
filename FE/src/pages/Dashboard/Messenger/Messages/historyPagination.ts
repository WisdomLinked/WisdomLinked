export const SCROLL_TOP_FETCH_THRESHOLD_PX = 24;

export function shouldRequestOlderMessages(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    thresholdPx: number = SCROLL_TOP_FETCH_THRESHOLD_PX,
): boolean {
    if (scrollHeight <= clientHeight) return false;
    return scrollTop <= thresholdPx;
}

export function preservedScrollTopAfterPrepend(
    prevScrollHeight: number,
    nextScrollHeight: number,
    prevScrollTop: number,
): number {
    const delta = Math.max(0, nextScrollHeight - prevScrollHeight);
    return Math.max(0, prevScrollTop + delta);
}

