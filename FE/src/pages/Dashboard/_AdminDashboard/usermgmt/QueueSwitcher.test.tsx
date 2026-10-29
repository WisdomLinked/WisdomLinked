import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueueSwitcher, { USER_MGMT_QUEUES } from './QueueSwitcher';

describe('QueueSwitcher', () => {
  it('shows every queue and marks the current one as selected', () => {
    render(<QueueSwitcher value="ReviewQueue" onChange={vi.fn()} />);

    for (const option of USER_MGMT_QUEUES) {
      expect(screen.getByRole('radio', { name: new RegExp(option.label, 'i') })).toBeTruthy();
    }

    expect(screen.getByRole('radio', { name: /needs review/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /all users/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('switches queues with a single click', async () => {
    const onChange = vi.fn();
    const actor = userEvent.setup();
    render(<QueueSwitcher value="ReviewQueue" onChange={onChange} />);

    await actor.click(screen.getByRole('radio', { name: /all users/i }));
    expect(onChange).toHaveBeenCalledWith(USER_MGMT_QUEUES.find(q => q.value === 'User'));
  });
});
