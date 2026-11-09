import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SnapshotMonthlyChart, { chartHasData, pointDisplay } from './SnapshotMonthlyChart';

const months = (rows: Array<[string, number, Record<string, number>?]>) =>
  rows.map(([month, count, amountsByCurrency]) => ({ month, count, ...(amountsByCurrency ? { amountsByCurrency } : {}) }));

describe('SnapshotMonthlyChart', () => {
  it('draws bars for months that had payments even when all their money was refunded', () => {
    const points = months([['2026-09', 0], ['2026-10', 2, {}]]);
    expect(chartHasData(points, true)).toBe(true);
    render(<SnapshotMonthlyChart points={points} useAmount title="Payments collected per month" emptyLabel="No payments in this range" />);
    expect(screen.queryByText('No payments in this range')).toBeNull();
    expect(screen.getByRole('button', { name: 'October 2026: $0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'September 2026: —' })).toBeInTheDocument();
  });

  it('says there were no payments only when no month had any', () => {
    const points = months([['2026-09', 0], ['2026-10', 0]]);
    expect(chartHasData(points, true)).toBe(false);
    render(<SnapshotMonthlyChart points={points} useAmount title="t" emptyLabel="No payments in this range" />);
    expect(screen.getByText('No payments in this range')).toBeInTheDocument();
  });

  it('labels the tallest month and highlights the latest month with payments', () => {
    const points = months([['2026-08', 1, { usd: 5000 }], ['2026-09', 3, { usd: 30000 }], ['2026-10', 0]]);
    render(<SnapshotMonthlyChart points={points} useAmount title="t" emptyLabel="e" />);
    expect(screen.getAllByText('$300')).toHaveLength(2); // the top-of-chart label and the highlighted month
    expect(screen.getByText(/September 2026:/)).toBeInTheDocument();
    expect(pointDisplay(points[0], true)).toBe('$50');
  });

  it('count charts are unchanged', () => {
    expect(pointDisplay({ month: '2026-09', count: 12 }, false)).toBe('12');
  });
});
