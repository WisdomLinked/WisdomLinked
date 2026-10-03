import React from 'react';
import type { Exam } from '../../content/resourcesTimeline';

export default function ExamGrid({ items }: { items: Exam[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 min-[800px]:grid-cols-3">
      {items.map((exam) => (
        <li key={exam.name} className="min-w-0 rounded-xl bg-res-tint p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-res-blue">{exam.category}</p>
          <p className="mt-1 font-semibold text-slate-900">{exam.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{exam.description}</p>
        </li>
      ))}
    </ul>
  );
}
