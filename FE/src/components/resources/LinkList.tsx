import React from 'react';
import type { ResourceLink } from '../../content/resourcesTimeline';
import ExternalLink from './ExternalLink';
import { MOTION } from './styles';

export default function LinkList({ items }: { items: ResourceLink[] }) {
  return (
    <ul className="divide-y divide-res-line overflow-hidden rounded-xl border border-res-line">
      {items.map((item) => (
        <li key={item.href}>
          <ExternalLink
            href={item.href}
            className={`grid grid-cols-[40px_minmax(0,1fr)] items-center gap-4 px-4 py-3.5 transition-colors ${MOTION} hover:bg-res-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wl-brand/40 min-[560px]:grid-cols-[40px_minmax(0,1fr)_auto]`}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-res-line bg-res-tint text-[10px] font-bold tracking-wide text-wl-brand"
              aria-hidden
            >
              {item.monogram}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{item.name}</span>
              <span className="mt-0.5 block text-sm text-slate-600">{item.description}</span>
            </span>
            <span className="hidden whitespace-nowrap text-xs text-slate-500 min-[560px]:inline">
              {item.source}
              <span aria-hidden> ↗</span>
            </span>
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}
