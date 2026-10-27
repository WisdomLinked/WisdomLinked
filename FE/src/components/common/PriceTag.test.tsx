import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriceTag from './PriceTag';

describe('PriceTag', () => {
  it('renders the starting-at hourly rate', () => {
    render(<PriceTag label="Starting at" amount={45} suffix="/ hr" />);
    expect(screen.getByText('Starting at')).toBeInTheDocument();
    expect(screen.getByText('$45')).toBeInTheDocument();
    expect(screen.getByText('/ hr')).toBeInTheDocument();
    expect(screen.getByLabelText('Starting at 45 dollars per hour')).toBeInTheDocument();
  });

  it('renders Free in emerald and hides the suffix', () => {
    render(<PriceTag label="Per seat" amount={0} suffix="· 1 hr" />);
    expect(screen.getByText('Free')).toHaveClass('text-emerald-700');
    expect(screen.queryByText('· 1 hr')).toBeNull();
    expect(screen.getByLabelText('Free')).toBeInTheDocument();
  });

  it('renders nothing when the amount is missing', () => {
    const { container } = render(<PriceTag label="Starting at" amount={null} suffix="/ hr" />);
    expect(container).toBeEmptyDOMElement();
  });
});
