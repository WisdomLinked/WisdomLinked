import React from 'react';

export default function Checklist({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-slate-900">{label}</span>
      <ul className="contents">
        {items.map((item) => (
          <li key={item} className="rounded-full border border-res-line bg-res-tint px-2.5 py-1 text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
