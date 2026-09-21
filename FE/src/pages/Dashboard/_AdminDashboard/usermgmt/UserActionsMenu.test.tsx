import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserActionsMenu from './UserActionsMenu';

const handlers = () => ({
  onApprove: vi.fn(),
  onBlock: vi.fn(),
  onManage: vi.fn(),
  onImpersonate: vi.fn(),
  onAudit: vi.fn(),
});

describe('UserActionsMenu', () => {
  it('shows Approve and Block for review users and calls handlers', async () => {
    const user = userEvent.setup();
    const fns = handlers();
    render(
      <UserActionsMenu
        user={{ email: 'ann@x.com', role: 'customer', status: 'review' }}
        isReviewQueue={false}
        {...fns}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'User actions' }));
    const menu = screen.getByRole('menu', { name: 'User actions' });
    expect(within(menu).getByRole('menuitem', { name: 'Approve' })).toHaveClass('text-green');
    expect(within(menu).getByRole('menuitem', { name: 'Block' })).toHaveClass('text-red');
    expect(within(menu).getByRole('menuitem', { name: 'Manage' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Impersonate' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Audit' })).toBeInTheDocument();

    await user.click(within(menu).getByRole('menuitem', { name: 'Approve' }));
    expect(fns.onApprove).toHaveBeenCalledTimes(1);
  });

  it('hides review actions and Impersonate for an active admin', async () => {
    const user = userEvent.setup();
    render(
      <UserActionsMenu
        user={{ email: 'admin@x.com', role: 'admin', status: 'active' }}
        isReviewQueue={false}
        {...handlers()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'User actions' }));
    const menu = screen.getByRole('menu', { name: 'User actions' });
    expect(within(menu).queryByRole('menuitem', { name: 'Approve' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Block' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Impersonate' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Manage' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Audit' })).toBeInTheDocument();
  });
});
