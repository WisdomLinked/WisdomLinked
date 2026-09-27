import { Star } from 'lucide-react';

export default function RatingsSummary({ rows }: { rows: string[] }) {
  return (
    <ul className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
      {rows.map((row) => (
        <li key={row} className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold text-slate-800">{row}</span>
          <span className="flex items-center gap-0.5 text-amber-500" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
