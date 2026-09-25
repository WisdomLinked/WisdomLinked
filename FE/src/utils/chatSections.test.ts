import { describe, expect, it } from 'vitest';
import {
  CHAT_SECTION_DEFAULT,
  CHAT_SECTION_ITEMS,
  chatSectionEmptySubtitle,
  chatSectionEmptyTitle,
  chatSectionHeading,
  isChatSectionUnset,
  normalizeChatSection,
  sectionForChatTarget,
  showsAppointments,
  showsCommunities,
  showsSeminars,
} from './chatSections';

describe('opening Chat before picking a section', () => {
  it('starts with nothing selected', () => {
    expect(CHAT_SECTION_DEFAULT).toBe('none');
    expect(isChatSectionUnset(CHAT_SECTION_DEFAULT)).toBe(true);
  });

  it('lists nothing, so the page has only the prompt to show', () => {
    expect(showsCommunities('none')).toBe(false);
    expect(showsAppointments('none')).toBe(false);
    expect(showsSeminars('none')).toBe(false);
  });

  it('asks the viewer to choose from the dropdown', () => {
    expect(chatSectionEmptyTitle('none')).toBe(
      'Select an option in the dropdown to open your chats',
    );
    expect(chatSectionEmptySubtitle('none')).toBe('');
  });
});

describe('selecting one section', () => {
  it.each([
    ['communities', showsCommunities],
    ['appointments', showsAppointments],
    ['seminars', showsSeminars],
  ] as const)('shows only %s', (section, predicate) => {
    const all = [showsCommunities, showsAppointments, showsSeminars];
    expect(predicate(section)).toBe(true);
    expect(all.filter(fn => fn(section))).toHaveLength(1);
  });

  it('shows none of the three on direct messages, which is a placeholder for now', () => {
    expect(showsCommunities('direct')).toBe(false);
    expect(showsAppointments('direct')).toBe(false);
    expect(showsSeminars('direct')).toBe(false);
  });

  it('prompts to pick a chat once a section is open', () => {
    for (const s of ['communities', 'appointments', 'seminars', 'direct'] as const) {
      expect(chatSectionEmptyTitle(s)).toBe('Choose a chat from the list to get started.');
      expect(isChatSectionUnset(s)).toBe(false);
    }
  });
});

describe('dropdown entries', () => {
  it('lists the four options in order, in caps', () => {
    expect(CHAT_SECTION_ITEMS.map(i => i.label)).toEqual([
      'DIRECT MESSAGES',
      '1:1 APPOINTMENTS',
      'SEMINARS',
      'COMMUNITIES',
    ]);
  });

  it('every state the page can be in is reachable from the dropdown', () => {
    // 'none' is what Chat itself opens on, so it needs no entry; everything else must.
    const reachable = new Set<string>([...CHAT_SECTION_ITEMS.map(i => i.id), 'none']);
    for (const s of ['none', 'direct', 'appointments', 'communities', 'seminars']) {
      expect(reachable.has(s)).toBe(true);
    }
  });
});

describe('panel copy', () => {
  it('matches the empty-state line to what the section opens', () => {
    expect(chatSectionEmptySubtitle('communities')).toBe('Community rooms open in this panel.');
    expect(chatSectionEmptySubtitle('seminars')).toBe('Seminar chats open in this panel.');
    expect(chatSectionEmptySubtitle('appointments')).toBe('Direct messages open in this panel.');
  });

  it('heads the list panel with the selected section', () => {
    expect(chatSectionHeading('communities')).toBe('Communities');
    expect(chatSectionHeading('seminars')).toBe('Seminars');
    expect(chatSectionHeading('appointments')).toBe('1:1 Appointments');
    expect(chatSectionHeading('direct')).toBe('Direct Messages');
  });
});

describe('deep links land where their conversation is listed', () => {
  it('sends a DM handoff to 1:1 appointments', () => {
    expect(sectionForChatTarget('dm')).toBe('appointments');
  });

  it('sends a community handoff to communities', () => {
    expect(sectionForChatTarget('community')).toBe('communities');
  });

  it('sends a seminar handoff to seminars', () => {
    expect(sectionForChatTarget('seminar')).toBe('seminars');
  });

  it('never drops a handoff on a section that would hide its row', () => {
    for (const target of ['dm', 'community', 'seminar'] as const) {
      const landed = sectionForChatTarget(target);
      expect(isChatSectionUnset(landed)).toBe(false);
      expect(landed).not.toBe('direct');
    }
  });
});

describe('stored values', () => {
  it('falls back to the prompt for anything unrecognised', () => {
    expect(normalizeChatSection(null)).toBe('none');
    expect(normalizeChatSection('')).toBe('none');
    expect(normalizeChatSection('all')).toBe('none');
    expect(normalizeChatSection(undefined)).toBe('none');
    expect(normalizeChatSection(42)).toBe('none');
  });

  it('keeps a value it recognises', () => {
    expect(normalizeChatSection('seminars')).toBe('seminars');
    expect(normalizeChatSection('direct')).toBe('direct');
  });
});
