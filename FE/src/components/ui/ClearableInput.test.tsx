import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClearableInput from './ClearableInput';

function ControlledField() {
  const [value, setValue] = useState('');
  return (
    <ClearableInput
      aria-label="Filter by email"
      value={value}
      onChange={e => setValue(e.target.value)}
    />
  );
}

describe('ClearableInput', () => {
  it('hides the clear control when empty and shows it when there is text', async () => {
    const user = userEvent.setup();
    render(<ControlledField />);
    const input = screen.getByLabelText('Filter by email');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    await user.type(input, 'ann@x.com');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('clears bound state and refocuses the input', async () => {
    const user = userEvent.setup();
    render(<ControlledField />);
    const input = screen.getByLabelText('Filter by email');
    await user.type(input, 'ann@x.com');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('clears on Escape while the input is focused', async () => {
    const user = userEvent.setup();
    render(<ControlledField />);
    const input = screen.getByLabelText('Filter by email');
    await user.type(input, 'pat');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('uses the shared filter control size by default', () => {
    render(<ControlledField />);
    const input = screen.getByLabelText('Filter by email');
    expect(input.className).toContain('h-[50px]');
    expect(input.className).toContain('text-base');
    expect(input.className).toContain('px-6');
  });
});
