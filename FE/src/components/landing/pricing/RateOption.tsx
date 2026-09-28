import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  rate: string;
  note: string;
};

export default function RateOption({ icon: Icon, title, rate, note }: Props) {
  return (
    <div className="flex h-full items-start gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#234C6A] ring-1 ring-slate-200">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h4 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h4>
        <p className="mt-1 text-[15px] font-medium text-slate-700 md:text-base">{rate}</p>
        <p className="mt-0.5 text-sm text-slate-500">{note}</p>
      </div>
    </div>
  );
}
