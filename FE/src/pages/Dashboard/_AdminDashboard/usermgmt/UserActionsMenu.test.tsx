import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserActionsMenu from './UserActionsMenu';

const handlers = () => ({
  onStatusChange: vi.fn(),
  onManage: vi.fn(),
  onImpersonate: vi.fn(),
  onAudit: vi.fn(),
});

const openMenu = async (status: string | undefined, role = 'customer') => {
  const actor = userEvent.setup();
  const fns = handlers();
  render(<UserActionsMenu user={{ email: 'ann@x.com', role, status }} {...fns} />);
  await actor.click(screen.getByRole('button', { name: 'User actions' }));
  return { actor, fns, menu: screen.getByRole('menu', { name: 'User actions' }) };
};

describe('UserActionsMenu', () => {
  it.each(['active', 'review', 'blocked'])('offers all three statuses to a %s user', async status => {
    const { menu } = await openMenu(status);
    const options = within(menu).getAllByRole('menuitemradio');
    expect(options.map(o => o.textContent)).toEqual(['Active', 'In review', 'Blocked']);
    const active = within(menu).getByRole('menuitemradio', { name: 'Active' });
    expect(active).toHaveClass('text-green');
    expect(active.className).not.toMatch(/text-green-\d/);
    expect(within(menu).getByRole('menuitemradio', { name: 'In review' })).toHaveClass('text-brownyellow');
    expect(within(menu).getByRole('menuitemradio', { name: 'Blocked' })).toHaveClass('text-red');
  });

  it('marks only the current status as checked', async () => {
    const { menu } = await openMenu('blocked');
    expect(within(menu).getByRole('menuitemradio', { name: 'Blocked' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitemradio', { name: 'In review' })).toHaveAttribute('aria-checked', 'false');
  });

  it('treats a user with no stored status as in review', async () => {
    const { menu } = await openMenu(undefined);
    expect(within(menu).getByRole('menuitemradio', { name: 'In review' })).toHaveAttribute('aria-checked', 'true');
  });

  it('changes the status when another option is picked, and closes the menu', async () => {
    const { actor, fns, menu } = await openMenu('active');
    await actor.click(within(menu).getByRole('menuitemradio', { name: 'Blocked' }));
    expect(fns.onStatusChange).toHaveBeenCalledWith('blocked');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does nothing when the current status is picked again', async () => {
    const { actor, fns, menu } = await openMenu('review');
    await actor.click(within(menu).getByRole('menuitemradio', { name: 'In review' }));
    expect(fns.onStatusChange).not.toHaveBeenCalled();
  });

  it('keeps Manage, Impersonate and Audit, after the statuses', async () => {
    const { actor, fns, menu } = await openMenu('active');
    const labels = Array.from(menu.querySelectorAll('[role^="menuitem"]'), el => el.textContent);
    expect(labels).toEqual(['Active', 'In review', 'Blocked', 'Manage', 'Impersonate', 'Audit']);
    await actor.click(within(menu).getByRole('menuitem', { name: 'Manage' }));
    expect(fns.onManage).toHaveBeenCalledTimes(1);
  });

  it('still hides Impersonate for an admin, but offers the statuses', async () => {
    const { menu } = await openMenu('active', 'admin');
    expect(within(menu).queryByRole('menuitem', { name: 'Impersonate' })).toBeNull();
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(within(menu).getByRole('menuitem', { name: 'Audit' })).toBeInTheDocument();
  });
});
