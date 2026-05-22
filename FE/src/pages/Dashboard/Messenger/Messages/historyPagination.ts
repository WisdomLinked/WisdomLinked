export const SCROLL_TOP_FETCH_THRESHOLD_PX = 24;
export const SCROLL_NEAR_BOTTOM_THRESHOLD_PX = 80;

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

export function isNearBottom(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    thresholdPx: number = SCROLL_NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
    if (scrollHeight <= clientHeight) return true;
    return scrollHeight - scrollTop - clientHeight <= thresholdPx;
}

export function scrollContainerToBottom(
    el: HTMLElement | null,
    behavior: ScrollBehavior = 'auto',
): void {
    if (!el) return;
    const top = el.scrollHeight;
    if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
        el.scrollTo({ top, behavior: 'smooth' });
    } else {
        el.scrollTop = top;
    }
}

export function scrollMessageIntoViewInContainer(
    container: HTMLElement,
    messageEl: HTMLElement,
    behavior: ScrollBehavior = 'smooth',
): void {
    const containerRect = container.getBoundingClientRect();
    const elRect = messageEl.getBoundingClientRect();
    const offsetTop = elRect.top - containerRect.top + container.scrollTop;
    const target = offsetTop - container.clientHeight / 2 + elRect.height / 2;
    container.scrollTo({ top: Math.max(0, target), behavior });
}

export function shouldAutoScrollOnAppend(options: {
    prevLength: number;
    nextLength: number;
    isPrepending: boolean;
    nearBottom: boolean;
    lastMessageOutgoing: boolean;
}): boolean {
    const { prevLength, nextLength, isPrepending, nearBottom, lastMessageOutgoing } = options;
    if (isPrepending || nextLength <= prevLength) return false;
    return nearBottom || lastMessageOutgoing;
}
