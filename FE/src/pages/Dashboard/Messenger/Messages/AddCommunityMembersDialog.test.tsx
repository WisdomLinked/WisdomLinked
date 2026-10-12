import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AddCommunityMembersDialog from './AddCommunityMembersDialog';
import * as api from '../../../../api/api';
vi.mock('../../../../api/api', () => ({
  getGroupMemberCandidates: vi.fn(), getMyFollowers: vi.fn(async () => ({ result: [] })),
  addParticipantsToCommunityChat: vi.fn(async () => ({ status: 'SUCCESS' })),
}));
vi.mock('../../../../api/chatApi', () => ({ fetchGroupHistory: vi.fn(async () => ({ messages: [] })) }));
vi.mock('../../../../actions/authActions', () => ({ updateMe: () => ({ type: 'refresh' }) }));
vi.mock('../../../../utils/notify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const group = { groupId: 'community', groupName: 'Research', admin: 'host', participants: ['member'], coModerators: ['moderator'] };
function show() {
  const close = vi.fn();
  const store = configureStore({ reducer: { auth: () => ({ userDetails: { role: 'expert' } }), friends: () => ({ friends: [] }) } });
  render(<Provider store={store}><AddCommunityMembersDialog open onClose={close} groupDetails={group} /></Provider>);
  return close;
}
describe('community expert invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getGroupMemberCandidates).mockResolvedValue({ result: [
      { _id: 'expert', username: 'Dr Rivera', email: 'rivera@example.com', role: 'expert' },
      { _id: 'student', username: 'Mei', email: 'mei@example.com', role: 'customer' },
      ...['host', 'member', 'moderator'].map(id => ({ _id: id, username: id, email: `${id}@example.com` })),
    ] });
  });
  it('lists students and experts, excluding existing members and moderators', async () => {
    show();
    await screen.findByText('Dr Rivera');
    expect(screen.getByText('Mei')).toBeInTheDocument();
    for (const name of ['host', 'member', 'moderator']) expect(screen.queryByText(name)).not.toBeInTheDocument();
    expect(api.getGroupMemberCandidates).toHaveBeenCalledWith('community');
  });
  it.each(['rivera', 'RIVERA@EXAMPLE.COM'])('finds and adds an expert using %s', async search => {
    const close = show();
    await screen.findByText('Dr Rivera');
    fireEvent.change(screen.getByPlaceholderText(/Search members/), { target: { value: search } });
    expect(screen.queryByText('Mei')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dr Rivera/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(api.addParticipantsToCommunityChat).toHaveBeenCalledWith({ communityChatId: 'community', participantIds: ['expert'] }));
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});
