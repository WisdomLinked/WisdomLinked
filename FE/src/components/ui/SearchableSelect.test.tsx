import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableSelect from './SearchableSelect';

const OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'mx', label: 'Mexico' },
];

describe('SearchableSelect', () => {
  it('renders placeholder and opens options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        aria-label="Country"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        placeholder="Select country"
      />,
    );

    expect(screen.getByText('Select country')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Country'));
    expect(screen.getByText('Canada')).toBeInTheDocument();
  });

  it('calls onChange when an option is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        aria-label="Country"
        options={OPTIONS}
        value={null}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Country'));
    await user.click(screen.getByText('Canada'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'ca', label: 'Canada' }),
    );
  });

  it('shows empty state when filter matches nothing', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        aria-label="Country"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByLabelText('Country'));
    await user.keyboard('zzzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('disables interaction when isDisabled', () => {
    render(
      <SearchableSelect
        aria-label="State"
        options={OPTIONS}
        value={null}
        onChange={() => {}}
        isDisabled
        placeholder="Select a country first"
      />,
    );

    const control = screen.getByLabelText('State');
    expect(control).toBeDisabled();
    expect(screen.getByText('Select a country first')).toBeInTheDocument();
  });
});
