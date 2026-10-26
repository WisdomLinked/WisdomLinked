import React from 'react';
import { Search, Users } from 'lucide-react';

export default function EmptyState({
  title,
  description,
  variant = 'search',
}: {
  title: string;
  description: string;
  variant?: 'search' | 'results';
}) {
  const Icon = variant === 'results' ? Users : Search;
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}
