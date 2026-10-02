import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Pagination, { paginationRangeLabel } from './Pagination';

describe('paginationRangeLabel', () => {
  it('formats an empty list and a populated page', () => {
    expect(paginationRangeLabel(0, 5, 0)).toBe('0 of 0');
    expect(paginationRangeLabel(0, 5, 12)).toBe('1–5 of 12');
    expect(paginationRangeLabel(2, 5, 12)).toBe('11–12 of 12');
  });
});

describe('Pagination', () => {
  it('disables previous on the first page and advances on next', () => {
    const onPage = vi.fn();
    render(
      <Pagination currentPage={0} totalCount={12} pageSize={5} onPage={onPage} onPageSize={vi.fn()} />,
    );
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('calls onPageSize when rows per page changes', () => {
    const onPageSize = vi.fn();
    render(
      <Pagination currentPage={0} totalCount={12} pageSize={5} onPage={vi.fn()} onPageSize={onPageSize} />,
    );
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });
    expect(onPageSize).toHaveBeenCalledWith(25);
  });

  it('hides the rows dropdown when onPageSize is omitted', () => {
    render(<Pagination currentPage={0} totalCount={40} pageSize={20} onPage={vi.fn()} />);
    expect(screen.queryByLabelText('Rows per page')).toBeNull();
    expect(screen.getByText('1–20 of 40')).toBeInTheDocument();
  });
});
