import React from 'react';

export const METRIC_VALUE_CLASS =
  'font-numeric font-semibold tabular-nums lining-nums tracking-tight text-ink';

const SIZE_CLASS = {
  lg: 'mt-1 text-3xl leading-none',
  md: 'mt-1 text-2xl leading-none',
} as const;

export default function MetricValue({
  children,
  size = 'md',
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  size?: 'lg' | 'md';
  className?: string;
  as?: 'div' | 'span';
}) {
  return (
    <Tag className={`${METRIC_VALUE_CLASS} ${SIZE_CLASS[size]} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
