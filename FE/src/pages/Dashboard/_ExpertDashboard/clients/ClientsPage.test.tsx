import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientsPage from './ClientsPage';

const soon = new Date(Date.now() + 2 * 3600000).toISOString();
const soonEnd = new Date(Date.now() + 3 * 3600000).toISOString();

const userDetails = {
  _id: 'exp1',
  groupChats: [
    { type: 'individual', status: 'active', admin: 'exp1', participants: [{ _id: 's1', username: 'Ana Lopez' }], start: soon, end: soonEnd },
  ],
  directConversations: [
    { rcChannelId: 'rid-ben', participants: [{ _id: 'exp1' }, { _id: 's2', username: 'Ben Kim', role: 'customer' }] },
  ],
};

function setup(details: any = userDetails) {
  const actions = { onOpenProfile: vi.fn(), onMessage: vi.fn(), onPropose: vi.fn() };
  render(
    <ClientsPage
      directory={[{ _id: 's9', username: 'Zed Stranger', role: 'customer' }]}
      userDetails={details}
      unreadByRid={{ 'rid-ben': 2 }}
      imageUrls={{}}
      actions={actions}
      onInvite={vi.fn()}
    />,
  );
  return actions;
}

describe('ClientsPage', () => {
  it('renders the header count and one card per client, booked first', () => {
    setup();
    expect(screen.getByText('2 students you mentor')).toBeTruthy();
    const names = screen.getAllByRole('button', { name: /^View .*'s profile$/ }).map((b) => b.textContent);
    expect(names).toEqual(['AL' + 'Ana Lopez', 'BK' + 'Ben Kim']);
    expect(screen.getAllByRole('button', { name: 'Propose session' })).toHaveLength(2);
  });

  it('shows a labeled Chat button with the unread count', async () => {
    const actions = setup();
    const chat = screen.getByRole('button', { name: 'Chat with Ben Kim, 2 unread' });
    expect(chat.textContent).toContain('Chat');
    await userEvent.click(chat);
    expect(actions.onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
  });

  it('card actions call the existing profile and propose handlers', async () => {
    const actions = setup();
    await userEvent.click(screen.getByRole('button', { name: "View Ana Lopez's profile" }));
    expect(actions.onOpenProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Propose session' })[0]);
    expect(actions.onPropose).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('toggles to all students', async () => {
    setup();
    const all = screen.getByRole('button', { name: 'All students' });
    await userEvent.click(all);
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('1 student on WisdomLinked')).toBeTruthy();
    expect(screen.getByText('Zed Stranger')).toBeTruthy();
  });

  it('shows an empty state when there are no clients', () => {
    setup({ _id: 'exp1' });
    expect(screen.getByText('No clients yet')).toBeTruthy();
  });
});
