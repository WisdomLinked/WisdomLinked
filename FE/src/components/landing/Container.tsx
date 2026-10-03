import type { ReactNode } from 'react';

export const CONTAINER_CLASS = 'mx-auto w-full max-w-6xl px-4 sm:px-6';

/** Horizontal inset of bordered content cards; content outside a card uses it to line up with card columns. */
export const CARD_INSET_X = 'px-6 md:px-8';

/** Matches the md+ card inset, with a transparent border standing in for the card's 1px border. */
export const CARD_ALIGNED_INSET_X = 'md:border-x md:border-transparent md:px-8';

export default function Container({ className = '', children }: { className?: string; children: ReactNode }) {
    return <div className={`${CONTAINER_CLASS} ${className}`}>{children}</div>;
}
