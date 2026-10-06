import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

const directory = [
  {
    _id: 's1',
    username: 'Ana Lopez',
    role: 'customer',
    country: 'Mexico',
    currentUniversity: 'UNAM',
    degreeSought: 'PhD',
    intendedIntake: 'Fall 2027',
    gpa: '3.8',
    keywords: [{ value: 'Robotics' }],
    services: [{ value: 'study_abroad' }, { value: 'research_guidance' }],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    _id: 's2',
    username: 'Ben Kim',
    role: 'customer',
    country: 'Korea',
    degreeSought: "Master's",
    services: [{ value: 'study_abroad' }],
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  { _id: 's9', username: 'Zed Stranger', role: 'customer' },
];

let location = '';
function LocationProbe() {
  const loc = useLocation();
  location = loc.search;
  return null;
}

function setup({ details = userDetails, url = '/clients' }: { details?: any; url?: string } = {}) {
  const actions = { onOpenProfile: vi.fn(), onMessage: vi.fn(), onPropose: vi.fn() };
  render(
    <MemoryRouter initialEntries={[url]}>
      <ClientsPage
        directory={directory}
        userDetails={details}
        unreadByRid={{ 'rid-ben': 2 }}
        imageUrls={{}}
        actions={actions}
        onInvite={vi.fn()}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
  return actions;
}

const cardNames = () => screen.getAllByRole('button', { name: /^View .*'s profile$/ }).map((b) => b.textContent);

describe('ClientsPage', () => {
  it('renders the header count and one card per client, newest first', () => {
    setup();
    expect(screen.getByText('2 students you mentor')).toBeTruthy();
    expect(cardNames()).toEqual(['Ana Lopez', 'Ben Kim']);
    expect(screen.getAllByRole('button', { name: 'Propose session' })).toHaveLength(2);
  });

  it('shows profile details, badges and dashes for missing fields', () => {
    setup();
    const ana = screen.getByRole('button', { name: "View Ana Lopez's profile" }).closest('article')!;
    const card = within(ana as HTMLElement);
    expect(card.getByText('My client')).toBeTruthy();
    expect(card.getByText('New')).toBeTruthy();
    expect(card.getByText('Mexico · UNAM')).toBeTruthy();
    expect(card.getByText('Robotics')).toBeTruthy();
    expect(card.getByText('PhD')).toBeTruthy();
    expect(card.getByText('Fall 2027')).toBeTruthy();
    expect(card.getByText('GPA 3.8')).toBeTruthy();
    expect(card.getByText('Research Guidance')).toBeTruthy();
    expect(card.queryByText('—')).toBeNull();

    const ben = screen.getByRole('button', { name: "View Ben Kim's profile" }).closest('article')!;
    expect(within(ben as HTMLElement).getAllByText('—')).toHaveLength(3);
    expect(card.queryByText(/view profile/i)).toBeNull();
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

  it('opens the profile when the card body is clicked, but not from its buttons', async () => {
    const actions = setup();
    await userEvent.click(screen.getByText('Mexico · UNAM'));
    expect(actions.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(actions.onOpenProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Chat with Ana Lopez' }));
    expect(actions.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(actions.onMessage).toHaveBeenCalledTimes(1);
  });

  it('shows the full text on hover for truncated fields', () => {
    setup();
    expect(screen.getByText('Mexico · UNAM').getAttribute('title')).toBe('Mexico · UNAM');
    expect(screen.getByText('Robotics').getAttribute('title')).toBe('Robotics');
  });

  it('toggles to all students and stores it in the URL', async () => {
    setup();
    const all = screen.getByRole('button', { name: 'All students' });
    await userEvent.click(all);
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('3 students on WisdomLinked')).toBeTruthy();
    expect(screen.getByText('Zed Stranger')).toBeTruthy();
    expect(location).toBe('?scope=all');
  });

  it('requires every selected service and shows removable chips', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Research Guidance', pressed: false }));
    expect(cardNames()).toEqual(['Ana Lopez']);
    expect(screen.getByText('Showing 1 of 2 students')).toBeTruthy();
    expect(location).toBe('?services=Research+Guidance');

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Research Guidance' }));
    expect(cardNames()).toEqual(['Ana Lopez', 'Ben Kim']);
    expect(screen.queryByText('Active:')).toBeNull();
  });

  it('filters with the custom dropdown via keyboard', async () => {
    setup();
    const trigger = screen.getByRole('button', { name: /Country/ });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['All countries', 'Korea', 'Mexico']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(cardNames()).toEqual(['Ben Kim']);
    expect(location).toBe('?country=Korea');
  });

  it('restores filters from the URL and clears them from the empty state', async () => {
    setup({ url: '/clients?country=Korea&services=Research+Guidance' });
    expect(screen.getByText('No students match these filters')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(cardNames()).toEqual(['Ana Lopez', 'Ben Kim']);
    expect(location).toBe('');
  });

  it('debounces search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setup();
      await userEvent.type(screen.getByLabelText('Search'), 'unam');
      expect(cardNames()).toHaveLength(2);
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(cardNames()).toEqual(['Ana Lopez']);
      expect(location).toBe('?q=unam');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an empty state when there are no clients', () => {
    setup({ details: { _id: 'exp1' } });
    expect(screen.getByText('No clients yet')).toBeTruthy();
  });
});
