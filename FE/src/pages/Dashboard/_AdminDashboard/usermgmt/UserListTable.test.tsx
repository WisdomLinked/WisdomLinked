import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserListTable from './UserListTable';

const user = {
  _id: 'u1',
  email: 'ann@x.com',
  username: 'Ann',
  title: 'Advisor',
  role: 'expert',
  status: 'active',
  phoneNumber: '555-0100',
  country: { name: 'USA' },
  state: { name: 'CA' },
  city: { name: 'LA' },
};

describe('UserListTable', () => {
  it('keeps secondary fields hidden until a row is expanded', async () => {
    const actor = userEvent.setup();
    render(
      <UserListTable
        users={[user]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Ann').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ann@x.com').length).toBeGreaterThan(0);
    expect(screen.queryByText('Advisor')).toBeNull();
    expect(screen.queryByText('USA')).toBeNull();

    await actor.click(screen.getAllByRole('button', { name: 'Show details' })[0]);
    expect(screen.getAllByText('Advisor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('555-0100').length).toBeGreaterThan(0);
  });

  it('shows status as plain text, with no dropdown, in both the mobile card and the desktop row', () => {
    render(
      <UserListTable
        users={[user, { ...user, _id: 'u2', email: 'bo@x.com', status: 'blocked' }, { ...user, _id: 'u3', email: 'cy@x.com', status: undefined }]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
    const active = screen.getAllByText('Active');
    expect(active).toHaveLength(2);
    active.forEach(el => {
      expect(el).toHaveClass('text-wl-brand');
      expect(el).not.toHaveClass('text-green');
    });
    const blocked = screen.getAllByText('Blocked');
    expect(blocked).toHaveLength(2);
    blocked.forEach(el => expect(el).toHaveClass('text-red'));
    expect(screen.getAllByText('In review')).toHaveLength(2);
  });

  it.each([
    ['mobile card', 0],
    ['desktop row', 1],
  ])('changes a status from the %s menu', async (_where, menuIndex) => {
    const actor = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <UserListTable
        users={[user]}
        emptyMessage="None"
        onStatusChange={onStatusChange}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
      />,
    );

    const triggers = screen.getAllByRole('button', { name: 'User actions' });
    expect(triggers).toHaveLength(2);
    await actor.click(triggers[menuIndex]);
    await actor.click(screen.getByRole('menuitemradio', { name: 'Blocked' }));
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ email: 'ann@x.com' }), 'blocked');
  });
});
