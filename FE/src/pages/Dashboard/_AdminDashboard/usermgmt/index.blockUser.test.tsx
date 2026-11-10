import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({
  doFilterUsers: vi.fn(),
  doUpdateProfileByAdmin: vi.fn(),
  doUnlockUserLogin: vi.fn(),
  doGetUserBlockReason: vi.fn(),
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

import { doFilterUsers, doGetUserBlockReason, doUpdateProfileByAdmin, profileImageFetch } from '../../../../api/api';
import UserMgmt from './index';

const mockedImage = vi.mocked(profileImageFetch);
const mockedFilter = vi.mocked(doFilterUsers);
const mockedUpdate = vi.mocked(doUpdateProfileByAdmin);
const mockedReason = vi.mocked(doGetUserBlockReason);

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
    mockedReason.mockReset();
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

  it('blocking a user another admin already blocked updates the row and says the reason was not saved', async () => {
    mockedUpdate.mockResolvedValue({ result: { ...ANN, status: 'blocked' }, alreadyBlocked: true } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'Blocked');
    await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Second reason');
    await actor.click(screen.getByRole('button', { name: 'Block user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already blocked');
    expect(screen.getAllByRole('button', { name: 'View reason for blocking' })).toHaveLength(2);
    await actor.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
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

  it('the icon on a blocked row opens the reason for that user, and closes again', async () => {
    mockedFilter.mockResolvedValue({ result: [{ ...ANN, status: 'blocked' }], totalCount: 1 } as any);
    mockedReason.mockResolvedValue({ status: 'SUCCESS', reason: 'Spamming students' } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await screen.findAllByText('ann@x.com');
    const icons = screen.getAllByRole('button', { name: 'View reason for blocking' });
    await actor.click(icons[icons.length - 1]);
    const dialog = screen.getByRole('dialog', { name: 'Reason for blocking this user' });
    expect(await within(dialog).findByText('Spamming students')).toBeInTheDocument();
    expect(mockedReason).toHaveBeenCalledWith('u1');
    await actor.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('the icon appears once a user is blocked, and goes when they are unblocked', async () => {
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await screen.findAllByText('ann@x.com');
    expect(screen.queryByRole('button', { name: 'View reason for blocking' })).toBeNull();

    mockedUpdate.mockResolvedValueOnce({ result: { ...ANN, status: 'blocked' } } as any);
    await pickStatus(actor, 'Blocked');
    await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Spam');
    await actor.click(screen.getByRole('button', { name: 'Block user' }));
    expect(screen.getAllByRole('button', { name: 'View reason for blocking' })).toHaveLength(2);

    mockedUpdate.mockResolvedValueOnce({ result: ANN } as any);
    await pickStatus(actor, 'Active');
    expect(screen.queryByRole('button', { name: 'View reason for blocking' })).toBeNull();
  });

  it('In review applies straight away, with no popup and no reason', async () => {
    mockedUpdate.mockResolvedValue({ result: { ...ANN, status: 'review' } } as any);
    const actor = userEvent.setup();
    render(<UserMgmt />);
    await pickStatus(actor, 'In review');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockedUpdate).toHaveBeenCalledWith({ email: 'ann@x.com', status: 'review' });
  });

  describe('the profile photo survives a status change', () => {
    const PHOTO = 'data:image/png;base64,AAAA';
    const WITH_PHOTO = { ...ANN, image: 'IMG_2921.JPG' };

    const photosShown = async () => {
      await waitFor(() => expect(document.querySelectorAll('img').length).toBeGreaterThan(0));
      return Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    };

    beforeEach(() => {
      mockedImage.mockReset();
      mockedImage.mockResolvedValue(PHOTO as any);
    });

    it('after blocking', async () => {
      mockedFilter.mockResolvedValue({ result: [WITH_PHOTO], totalCount: 1 } as any);
      mockedUpdate.mockResolvedValue({ result: { ...WITH_PHOTO, status: 'blocked' } } as any);
      const actor = userEvent.setup();
      render(<UserMgmt />);
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
      await pickStatus(actor, 'Blocked');
      await actor.type(screen.getByRole('textbox', { name: /reason for blocking/ }), 'Spam');
      await actor.click(screen.getByRole('button', { name: 'Block user' }));
      expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
    });

    it('after unblocking', async () => {
      mockedFilter.mockResolvedValue({ result: [{ ...WITH_PHOTO, status: 'blocked' }], totalCount: 1 } as any);
      mockedUpdate.mockResolvedValue({ result: WITH_PHOTO } as any);
      const actor = userEvent.setup();
      render(<UserMgmt />);
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
      await pickStatus(actor, 'Active');
      await waitFor(() => expect(screen.queryByRole('button', { name: 'View reason for blocking' })).toBeNull());
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
    });

    it('after moving to review', async () => {
      mockedFilter.mockResolvedValue({ result: [WITH_PHOTO], totalCount: 1 } as any);
      mockedUpdate.mockResolvedValue({ result: { ...WITH_PHOTO, status: 'review' } } as any);
      const actor = userEvent.setup();
      render(<UserMgmt />);
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
      await pickStatus(actor, 'In review');
      await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getAllByText(/In review/i).length).toBeGreaterThan(0));
      expect(new Set(await photosShown())).toEqual(new Set([PHOTO]));
    });
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
