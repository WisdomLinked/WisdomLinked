import React from 'react';
import type { ClientStatus } from './clientModel';

export interface SummaryStat {
  label: string;
  value: number;
  status: ClientStatus;
}

export default function SummaryBar({
  stats,
  active,
  onToggle,
}: {
  stats: SummaryStat[];
  active: ClientStatus | 'all';
  onToggle: (status: ClientStatus) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Client summary"
      className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E5E2DB] bg-white shadow-sm md:grid-cols-4"
    >
      {stats.map((s, i) => {
        const pressed = active === s.status;
        return (
          <button
            key={s.label}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(s.status)}
            className={`flex flex-col items-start gap-0.5 px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#234C6A] ${
              i % 2 === 1 ? 'border-l border-[#E5E2DB]' : ''
            } ${i >= 2 ? 'border-t border-[#E5E2DB] md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''} ${
              pressed ? 'bg-[#E8EEF4]' : 'hover:bg-[#F5F3EF]'
            }`}
          >
            <span className="font-serif text-2xl leading-tight text-[#1A3A4A] tabular-nums">{s.value}</span>
            <span className={`text-xs font-medium ${pressed ? 'text-[#234C6A]' : 'text-[#7A7A72]'}`}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}