import React from 'react';

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium text-audit-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-audit-muted">{description}</p> : null}
      {action}
    </div>
  );
}
