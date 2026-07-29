import { describe, expect, it } from 'vitest';
import {
  displayRoomLabel,
  isMachineRoomLabel,
  looksLikeWlRoomName,
  shouldNotifyRoom,
} from './chatRoomLabel';

describe('isMachineRoomLabel', () => {
  it('flags Rocket.Chat slugs', () => {
    expect(isMachineRoomLabel('wl-group-6a3d8082d453a05cdb82c2db')).toBe(true);
    expect(isMachineRoomLabel('wl_abc123')).toBe(true);
    expect(isMachineRoomLabel('pradyumnayerabati14_gmail_com')).toBe(true);
    expect(isMachineRoomLabel('')).toBe(true);
    expect(isMachineRoomLabel(undefined)).toBe(true);
  });

  it('keeps human titles', () => {
    expect(isMachineRoomLabel('tmp group with Honai')).toBe(false);
    expect(isMachineRoomLabel('Test with Dr Wang')).toBe(false);
    expect(isMachineRoomLabel('Xiubin')).toBe(false);
  });
});

describe('looksLikeWlRoomName', () => {
  it('recognises WL-owned rooms by their slug', () => {
    expect(looksLikeWlRoomName('wl-group-6a3d8082d453a05cdb82c2db')).toBe(true);
    expect(looksLikeWlRoomName('WL_something')).toBe(true);
    expect(looksLikeWlRoomName('global-community')).toBe(true);
    expect(looksLikeWlRoomName('general')).toBe(false);
    expect(looksLikeWlRoomName('')).toBe(false);
  });
});

describe('shouldNotifyRoom', () => {
  const known = new Set(['rid-seminar', 'rid-dm']);

  it('notifies for rooms matched to a WisdomLinked chat', () => {
    expect(shouldNotifyRoom('rid-seminar', known, 'wl-group-6a3d8082d453a05cdb82c2db', false)).toBe(true);
    expect(shouldNotifyRoom('rid-dm', known, 'pradyumnayerabati14_gmail.com', false)).toBe(true);
  });

  it('ignores orphaned WL channels whose group chat is gone', () => {
    expect(shouldNotifyRoom('rid-orphan', known, 'wl-group-6a3d8082d453a05cdb82c2db', false)).toBe(false);
  });

  it("ignores Rocket.Chat's own rooms even though their names look human", () => {
    expect(shouldNotifyRoom('rid-general', known, 'general', false)).toBe(false);
    expect(shouldNotifyRoom('rid-general', known, 'general', true)).toBe(false);
  });

  it('falls back to the WL-name heuristic when resolution failed', () => {
    expect(shouldNotifyRoom('rid-orphan', known, 'wl-group-6a3d8082d453a05cdb82c2db', true)).toBe(true);
  });
});

describe('displayRoomLabel', () => {
  it('returns the human label untouched', () => {
    expect(displayRoomLabel('tmp group with Honai', 'Community')).toBe('tmp group with Honai');
  });

  it('replaces slugs with the fallback', () => {
    expect(displayRoomLabel('wl-group-6a3d8082d453a05cdb82c2db', 'Community')).toBe('Community');
    expect(displayRoomLabel('pradyumnayerabati14_gmail_com', 'Someone')).toBe('Someone');
    expect(displayRoomLabel('', 'Community')).toBe('Community');
  });
});
