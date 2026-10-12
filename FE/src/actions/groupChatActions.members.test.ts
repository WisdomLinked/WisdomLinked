import { beforeEach, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { refreshSeminarMembers } from './groupChatActions';
import { setChosenGroupChatDetails } from './chatActions';
import { actionTypes } from './types';
import { chatReducer } from '../reducers/chatReducer';
import { getMe } from '../api/api';
vi.mock('../api/api', () => ({ getMe: vi.fn(), createGroupChat: vi.fn(), leaveGroup: vi.fn(), deleteGroup: vi.fn() }));
vi.mock('../utils/notify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }));
const updated = { _id: 'seminar', name: 'Research', participants: [{ _id: 'expert', username: 'Invited expert' }] };
type TestAuthState = { userDetails: { groupChats: typeof updated[] } };
function makeStore() {
  const store = configureStore({ reducer: {
    chat: chatReducer,
    auth: (state: TestAuthState = { userDetails: { groupChats: [] } }, action: any): TestAuthState =>
      action.type === actionTypes.authenticate ? { userDetails: action.payload } : state,
  } });
  store.dispatch(setChosenGroupChatDetails({ groupId: 'seminar', groupName: 'Research', participants: [] } as any));
  return store;
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getMe).mockResolvedValue({ me: { groupChats: [updated] } } as any); });
it('refreshes the open seminar with the server-confirmed member list', async () => {
  const store = makeStore();
  await store.dispatch(refreshSeminarMembers('seminar') as any);
  expect(store.getState().chat.chosenGroupChatDetails?.participants).toEqual(updated.participants);
  expect(store.getState().auth.userDetails.groupChats).toEqual([updated]);
});
it('does not replace a different chat opened while the refresh is in flight', async () => {
  const store = makeStore();
  let finish!: (value: any) => void;
  vi.mocked(getMe).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const pending = store.dispatch(refreshSeminarMembers('seminar') as any);
  store.dispatch(setChosenGroupChatDetails({ groupId: 'other', groupName: 'Other' } as any));
  finish({ me: { groupChats: [updated] } });
  await pending;
  expect(store.getState().chat.chosenGroupChatDetails?.groupId).toBe('other');
});
