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

const toggle = () => screen.getByRole('button', { name: /Show Chat sections/i });

describe('the Chat dropdown', () => {
  it('keeps the four sections hidden until Chat or its chevron is clicked', () => {
    renderSidebar();

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
    fireEvent.click(toggle());
    expect(screen.getByRole('button', { name: 'SEMINARS' })).toBeInTheDocument();
  });

  it('lists the four options in order, in caps', () => {
    renderSidebar();
    fireEvent.click(toggle());

    for (const label of ['DIRECT MESSAGES', '1:1 APPOINTMENTS', 'COMMUNITIES', 'SEMINARS']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the section currently in view', () => {
    renderSidebar();
    fireEvent.click(toggle());

    expect(screen.getByRole('button', { name: 'COMMUNITIES' }).className).toMatch(/text-\[#234C6A\]/);
    expect(screen.getByRole('button', { name: 'SEMINARS' }).className).not.toMatch(/text-\[#234C6A\]/);
  });

  it('reports which section was picked, under which nav item', () => {
    const onNavigateSub = vi.fn();
    renderSidebar({ onNavigateSub });
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'COMMUNITIES' }));

    expect(onNavigateSub).toHaveBeenCalledWith('chat', 'communities');
  });

  it('collapses again when the chevron is clicked a second time', () => {
    renderSidebar();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: /Hide Chat sections/i }));

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
  });

  it('does not navigate away when only the chevron is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(toggle());

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('still navigates when the Chat item itself is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: /^Chat/ }));

    expect(onNavigate).toHaveBeenCalledWith('chat');
  });
});

describe('nav items without a dropdown', () => {
  it('gives no chevron to items that have no sections', () => {
    renderSidebar();

    expect(screen.queryByRole('button', { name: /Show Calendar sections/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show Settings sections/i })).not.toBeInTheDocument();
  });

  it('renders normally when no subItems are supplied at all', () => {
    render(<Sidebar activeItem="dashboard" onNavigate={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^Chat/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show Chat sections/i })).not.toBeInTheDocument();
  });
});

describe('opening the dropdown from the Chat item itself', () => {
  const chatItem = () => screen.getByRole('button', { name: /^Chat/ });

  it('expands the sections when the Chat item is clicked, not only the chevron', () => {
    renderSidebar();

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
    fireEvent.click(chatItem());

    for (const label of ['DIRECT MESSAGES', '1:1 APPOINTMENTS', 'COMMUNITIES', 'SEMINARS']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('navigates as well as expanding, so the prompt page still shows', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(chatItem());

    expect(onNavigate).toHaveBeenCalledWith('chat');
    expect(screen.getByRole('button', { name: 'SEMINARS' })).toBeInTheDocument();
  });

  it('closes the sections when Chat is clicked a second time', () => {
    renderSidebar();
    fireEvent.click(chatItem());
    fireEvent.click(chatItem());

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
  });

  it('opens and closes on alternate clicks, indefinitely', () => {
    renderSidebar();
    const isOpen = () => screen.queryByRole('button', { name: 'SEMINARS' }) !== null;

    for (const expected of [true, false, true, false, true]) {
      fireEvent.click(chatItem());
      expect(isOpen()).toBe(expected);
    }
  });

  it('closes what the chevron opened', () => {
    renderSidebar();
    fireEvent.click(toggle());
    fireEvent.click(chatItem());

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
  });

  it('navigates on every click, whether it is opening or closing', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(chatItem());
    fireEvent.click(chatItem());

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'chat');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'chat');
  });

  it('still lets the chevron collapse what the Chat item opened', () => {
    renderSidebar();
    fireEvent.click(chatItem());
    fireEvent.click(screen.getByRole('button', { name: /Hide Chat sections/i }));

    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
  });

  it('expands nothing when a nav item that has no sections is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: /^Calendar/ }));

    expect(onNavigate).toHaveBeenCalledWith('calendar');
    expect(screen.queryByRole('button', { name: 'SEMINARS' })).not.toBeInTheDocument();
  });
});

describe('the mobile drawer', () => {
  const openDrawer = () => fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  const drawerCopyOf = (name: RegExp) => {
    const matches = screen.getAllByRole('button', { name });
    return matches[matches.length - 1];
  };
  const isDrawerOpen = () =>
    screen.queryByRole('button', { name: 'Close navigation' }) !== null;

  it('closes when a nav item with no sections is picked', () => {
    renderSidebar();
    openDrawer();
    expect(isDrawerOpen()).toBe(true);

    fireEvent.click(drawerCopyOf(/^Calendar/));

    expect(isDrawerOpen()).toBe(false);
  });

  it('stays open when Chat is picked, so a section can be chosen', () => {
    renderSidebar();
    openDrawer();

    fireEvent.click(drawerCopyOf(/^Chat/));

    expect(isDrawerOpen()).toBe(true);
    expect(drawerCopyOf(/^SEMINARS$/)).toBeInTheDocument();
  });

  it('closes once a section is picked', () => {
    renderSidebar();
    openDrawer();
    fireEvent.click(drawerCopyOf(/^Chat/));
    fireEvent.click(drawerCopyOf(/^SEMINARS$/));

    expect(isDrawerOpen()).toBe(false);
  });
});
