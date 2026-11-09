import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SnapshotKpiStrip, { collectedValue, paymentKpis } from './SnapshotKpiStrip';

describe('paymentKpis', () => {
  it('Collected, Count with its meaning, and Average = Collected / Count', () => {
    expect(paymentKpis({ paymentsCount: 4, paymentsAmountByCurrency: { usd: 30000 } })).toEqual([
      { label: 'Collected', value: '$300' },
      { label: 'Count', value: '4', hint: 'Paid or partly refunded' },
      { label: 'Average', value: '$75.00' },
    ]);
  });

  it('reads $0, not a dash, when every payment in the range was refunded', () => {
    const kpis = paymentKpis({ paymentsCount: 2, paymentsAmountByCurrency: {} });
    expect(kpis[0].value).toBe('$0');
    expect(kpis[2].value).toBe('$0.00');
  });

  it('shows dashes when there were no payments, and no average across currencies', () => {
    expect(paymentKpis({ paymentsCount: 0, paymentsAmountByCurrency: {} }).map(k => k.value)).toEqual(['—', '0', '—']);
    expect(paymentKpis({ paymentsCount: 2, paymentsAmountByCurrency: { usd: 100, eur: 100 } })[2].value).toBe('—');
  });

  it('collectedValue never shows a count as money', () => {
    expect(collectedValue({}, 7)).toBe('$0');
    expect(collectedValue(undefined, 0)).toBe('—');
  });
});

describe('SnapshotKpiStrip', () => {
  it('lets an odd last figure fill the row on phones, and leaves an even set alone', () => {
    const { container, rerender } = render(<SnapshotKpiStrip kpis={[{ label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }]} />);
    const cells = () => Array.from(container.firstElementChild!.children) as HTMLElement[];
    expect(cells()[2].className).toContain('col-span-2 sm:col-span-1');
    expect(cells()[0].className).not.toContain('col-span-2');
    rerender(<SnapshotKpiStrip kpis={[{ label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }, { label: 'D', value: '4' }]} />);
    expect(cells().some(c => c.className.includes('col-span-2'))).toBe(false);
  });

  it('shows the loading label until there are figures', () => {
    render(<SnapshotKpiStrip kpis={[]} loadingLabel="Loading payment summary…" />);
    expect(screen.getByText('Loading payment summary…')).toBeInTheDocument();
  });
});
