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
        isReviewQueue={false}
        emptyMessage="None"
        onStatusChange={vi.fn()}
        onApprove={vi.fn()}
        onBlock={vi.fn()}
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
});
