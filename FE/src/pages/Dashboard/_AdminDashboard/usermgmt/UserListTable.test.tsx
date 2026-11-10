import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const openPeerProfile = vi.fn();

vi.mock('../../../../hooks/usePeerProfileModal', () => ({
  usePeerProfileModal: () => ({
    openPeerProfile,
    closePeerProfile: vi.fn(),
    peerProfileModal: null,
  }),
}));

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
  beforeEach(() => {
    openPeerProfile.mockClear();
  });

  it('opens the shared profile card when a desktop row is clicked', async () => {
    const actor = userEvent.setup();
    render(
      <UserListTable
        users={[user]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );

    expect(screen.queryByText('Advisor')).toBeNull();
    expect(screen.queryByText('USA')).toBeNull();

    await actor.click(screen.getAllByText('Ann')[0]);
    expect(openPeerProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        username: 'Ann',
        role: 'expert',
        email: 'ann@x.com',
        title: 'Advisor',
      }),
    );
  });

  it('opens the profile card from the mobile identity control', async () => {
    const actor = userEvent.setup();
    render(
      <UserListTable
        users={[user]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );

    await actor.click(screen.getByRole('button', { name: 'View profile for Ann' }));
    expect(openPeerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', username: 'Ann' }),
    );
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
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
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
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );

    const triggers = screen.getAllByRole('button', { name: 'User actions' });
    expect(triggers).toHaveLength(2);
    await actor.click(triggers[menuIndex]);
    await actor.click(screen.getByRole('menuitemradio', { name: 'Blocked' }));
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ email: 'ann@x.com' }), 'blocked');
  });

  it.each(['active', 'review', 'blocked'])('a locked %s user keeps their status with a small "(locked)" beside it', status => {
    const lockedUntil = new Date(Date.now() + 10 * 60_000).toISOString();
    render(
      <UserListTable
        users={[{ ...user, status, loginLock: { step: 'otp', lockedUntil } }]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );
    const label = { active: 'Active', review: 'In review', blocked: 'Blocked' }[status];
    const tags = screen.getAllByTestId('user-locked-tag');
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toHaveTextContent('(locked)');
      expect(tag).toHaveClass('text-[11px]', 'text-rose-600');
      expect(tag.className).not.toMatch(/text-red-\d/);
      expect(tag.parentElement?.textContent).toBe(`${label}(locked)`);
    }
  });

  it.each(['active', 'review', undefined])('offers no block reason for a %s user', status => {
    render(
      <UserListTable
        users={[{ ...user, status }]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'View reason for blocking' })).toBeNull();
  });

  it.each([
    ['mobile card', 0],
    ['desktop row', 1],
  ])('opens the reason from the %s without opening the profile card', async (_where, index) => {
    const actor = userEvent.setup();
    const onViewBlockReason = vi.fn();
    const blocked = { ...user, status: 'blocked' };
    render(
      <UserListTable
        users={[blocked]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={onViewBlockReason}
      />,
    );
    const icons = screen.getAllByRole('button', { name: 'View reason for blocking' });
    expect(icons).toHaveLength(2);
    await actor.click(icons[index]);
    expect(onViewBlockReason).toHaveBeenCalledTimes(1);
    expect(onViewBlockReason).toHaveBeenCalledWith(blocked);
    expect(openPeerProfile).not.toHaveBeenCalled();
  });

  it('a blocked and locked user shows both the "(locked)" tag and the reason icon', () => {
    const lockedUntil = new Date(Date.now() + 10 * 60_000).toISOString();
    render(
      <UserListTable
        users={[{ ...user, status: 'blocked', loginLock: { step: 'password', lockedUntil } }]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('user-locked-tag')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'View reason for blocking' })).toHaveLength(2);
  });

  it('shows no "(locked)" when the lock has run out or there is none', () => {
    render(
      <UserListTable
        users={[user, { ...user, _id: 'u2', email: 'bo@x.com', loginLock: { step: 'password', lockedUntil: new Date(Date.now() - 1000).toISOString() } }]}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onManage={vi.fn()}
        onImpersonate={vi.fn()}
        onAudit={vi.fn()}
        onUnlock={vi.fn()}
        onViewBlockReason={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('user-locked-tag')).toBeNull();
  });
});
