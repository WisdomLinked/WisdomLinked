import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiSelect, { type MultiSelectOption } from './MultiSelect';

const OPTIONS: MultiSelectOption[] = [
  { value: 'Study Abroad', label: 'Study Abroad' },
  { value: 'Work Abroad', label: 'Work Abroad' },
  { value: 'Research Guidance', label: 'Research Guidance' },
];

function Harness({
  initial = [],
  onChange,
}: {
  initial?: MultiSelectOption[];
  onChange?: (next: MultiSelectOption[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="services" id="services-label">Services you offer</label>
      <MultiSelect
        id="services"
        labelId="services-label"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        placeholder="Select services"
      />
      <p>outside</p>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Services you offer' });

describe('MultiSelect', () => {
  it('links the label to a listbox trigger and shows the placeholder', () => {
    render(<Harness />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Select services')).toBeInTheDocument();
  });

  it('toggles options by clicking rows and stays open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Services you offer' })).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'Work Abroad' }));
    await user.click(screen.getByRole('option', { name: 'Study Abroad' }));

    expect(onChange).toHaveBeenLastCalledWith([OPTIONS[1], OPTIONS[0]]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Work Abroad' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('option', { name: 'Work Abroad' }));
    expect(onChange).toHaveBeenLastCalledWith([OPTIONS[0]]);
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.click(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports arrow keys, Space/Enter to toggle and Escape to close', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    await user.keyboard('{ArrowDown} ');
    expect(onChange).toHaveBeenLastCalledWith([OPTIONS[1]]);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([OPTIONS[1], OPTIONS[2]]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('removes a chip without opening the menu', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={[OPTIONS[0], OPTIONS[2]]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Remove Study Abroad' }));
    expect(onChange).toHaveBeenLastCalledWith([OPTIONS[2]]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
