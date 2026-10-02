import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';
import { CHAT_SECTION_ITEMS } from '../../utils/chatSections';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const renderSidebar = (props: Record<string, unknown> = {}) =>
  render(
    <Sidebar
      activeItem="chat"
      onNavigate={vi.fn()}
      subItems={{ chat: CHAT_SECTION_ITEMS }}
      activeSubItem="communities"
      onNavigateSub={vi.fn()}
      {...props}
    />,
  );

const expand = () => fireEvent.click(screen.getByRole('button', { name: /Show Chat sections/i }));

describe('unread badges on the Chat sections', () => {
  it('puts the count beside the section it belongs to', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 3 } } });
    expand();

    expect(screen.getByLabelText('3 unread in seminars')).toBeInTheDocument();
  });

  it('leaves the other sections unbadged', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 3 } } });
    expand();

    expect(screen.queryByLabelText(/unread in communities/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unread in 1:1 appointments/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unread in direct messages/)).not.toBeInTheDocument();
  });

  it('badges several sections at once', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 2, communities: 5, appointments: 1 } } });
    expand();

    expect(screen.getByLabelText('2 unread in seminars')).toBeInTheDocument();
    expect(screen.getByLabelText('5 unread in communities')).toBeInTheDocument();
    expect(screen.getByLabelText('1 unread in 1:1 appointments')).toBeInTheDocument();
  });

  it('shows no badge for a zero or missing count', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 0 } } });
    expand();

    expect(screen.queryByLabelText(/unread in/)).not.toBeInTheDocument();
  });

  it('caps the display at 99+ while keeping the real number in the label', () => {
    renderSidebar({ subItemCounts: { chat: { communities: 150 } } });
    expand();

    expect(screen.getByLabelText('150 unread in communities')).toHaveTextContent('99+');
  });

  it('still shows the section label next to the badge', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 4 } } });
    expand();

    expect(screen.getByRole('button', { name: /^SEMINARS/ })).toHaveTextContent('SEMINARS');
  });

  it('still navigates when a badged section is clicked', () => {
    const onNavigateSub = vi.fn();
    renderSidebar({ subItemCounts: { chat: { seminars: 4 } }, onNavigateSub });
    expand();
    fireEvent.click(screen.getByRole('button', { name: /^SEMINARS/ }));

    expect(onNavigateSub).toHaveBeenCalledWith('chat', 'seminars');
  });

  it('renders the sections unchanged when no counts are supplied at all', () => {
    renderSidebar();
    expand();

    expect(screen.getByRole('button', { name: 'SEMINARS' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread in/)).not.toBeInTheDocument();
  });

  it('ignores counts aimed at a different nav item', () => {
    renderSidebar({ subItemCounts: { calendar: { seminars: 7 } } });
    expand();

    expect(screen.queryByLabelText(/unread in/)).not.toBeInTheDocument();
  });

  it('keeps the badge hidden while the dropdown is collapsed', () => {
    renderSidebar({ subItemCounts: { chat: { seminars: 3 } } });

    expect(screen.queryByLabelText('3 unread in seminars')).not.toBeInTheDocument();
  });
});
