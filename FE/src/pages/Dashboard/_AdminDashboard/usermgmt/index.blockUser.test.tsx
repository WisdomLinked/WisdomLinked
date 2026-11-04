import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({
  doFilterUsers: vi.fn(),
  doUpdateProfileByAdmin: vi.fn(),
  doUnlockUserLogin: vi.fn(),
  profileImageFetch: vi.fn(),
  impersonateUser: vi.fn(),
  doGetPendingUsers: vi.fn(async () => []),
  doGetPendingLogins: vi.fn(async () => []),
  doDeletePendingUserById: vi.fn(),
  doDeletePendingLoginById: vi.fn(),
  doActivatePendingUserById: vi.fn(),
}));
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../../../../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));
vi.mock('../../../../components/ImpersonationBanner', () => ({ setImpersonationSession: vi.fn() }));
vi.mock('./manageModal', () => ({ default: () => null }));
vi.mock('./auditModal', () => ({ default: () => null }));

import { doFilterUsers, doUpdateProfileByAdmin } from '../../../../api/api';
import UserMgmt from './index';

const mockedFilter = vi.mocked(doFilterUsers);
const mockedUpdate = vi.mocked(doUpdateProfileByAdmin);

const ANN = { _id: 'u1', email: 'ann@x.com', username: 'ann', role: 'customer', status: 'active' };

const pickStatus = async (actor: ReturnType<typeof userEvent.setup>, name: string) => {
  await screen.findAllByText('ann@x.com');
  const triggers = screen.getAllByRole('button', { name: 'User actions' });
  await actor.click(triggers[triggers.length - 1]);
  await actor.click(within(screen.getByRole('menu', { name: 'User actions' })).getByRole('menuitemradio', { name }));
};

describe('User Management: changing a status', () => {
  beforeEach(() => {
    mockedFilter.mockReset();
    mockedUpdate.mockReset();
    mockedFilter.mockResolvedValue({ result: [ANN], totalCount: 1 } as any);
  });

  it('picking Blocked only asks for a reason; nothing is sent yet', async () => {
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    expect(screen.getByRole('dialog', { name: /reason for blocking/ })).toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('Cancel leaves the user as they were', async () => {
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText('Blocked')).toBeNull();
  });

  it('confirming blocks the user with the reason, closes the popup and updates the row', async () => {
    mockedUpdate.mockResolvedValue({ result: { ...ANN, status: 'blocked' } } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Spamming students');
    await actor.click(screen.getByRole('button', { name: 'Block user' }));
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    expect(mockedUpdate).toHaveBeenCalledWith({ email: 'ann@x.com', status: 'blocked', statusReason: 'Spamming students' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });

  it('a failed block keeps the popup open with the reason', async () => {
    mockedUpdate.mockResolvedValue(false as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Spam');
    await actor.click(screen.getByRole('button', { name: 'Block user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not block');
    expect(screen.getByRole('textbox', { name: /reason for blocking/ })).toHaveValue('Spam');
  });

  it('a reason typed for one user does not carry over to the next', async () => {
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Spam');
    await actor.click(screen.getByRole('button', { name: 'Cancel' }));
    await pickStatus(actor, 'Blocked');
    expect(screen.getByRole('textbox', { name: /reason for blocking/ })).toHaveValue('');
  });

  it('In review applies straight away, with no popup and no reason', async () => {
    mockedUpdate.mockResolvedValue({ result: { ...ANN, status: 'review' } } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'In review');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).toHaveBeenCalledWith({ email: 'ann@x.com', status: 'review' });
  });

  it('Active applies straight away, with no popup and no reason', async () => {
    mockedFilter.mockResolvedValue({ result: [{ ...ANN, status: 'blocked' }], totalCount: 1 } as any);
    mockedUpdate.mockResolvedValue({ result: ANN } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Active');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).toHaveBeenCalledWith({ email: 'ann@x.com', status: 'active' });
  });
});
