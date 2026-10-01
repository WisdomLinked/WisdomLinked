import { describe, expect, it } from 'vitest';
import { chatTargetsByRid } from './chatNavTarget';

describe('chatTargetsByRid', () => {
  it('routes a seminar room to the seminars list', () => {
    const map = chatTargetsByRid([], [{ rcChannelId: 'rid-sem', type: 'seminar' }], []);
    expect(map).toEqual({ 'rid-sem': 'seminar' });
  });

  it('routes a community room to the communities list', () => {
    const map = chatTargetsByRid([], [{ rcChannelId: 'rid-com', type: 'community' }], []);
    expect(map).toEqual({ 'rid-com': 'community' });
  });

  it('routes a direct message to the dm list', () => {
    expect(chatTargetsByRid(['rid-dm'], [], [])).toEqual({ 'rid-dm': 'dm' });
  });

  it('routes a confirmed 1:1 appointment room to the appointments list', () => {
    const map = chatTargetsByRid(
      [],
      [{ rcChannelId: 'rid-appt', type: 'individual', status: 'active' }],
      [],
    );
    expect(map).toEqual({ 'rid-appt': 'appointment' });
  });

  it('omits an appointment that has no row to open, so no dead badge is shown', () => {
    const map = chatTargetsByRid(
      [],
      [
        { rcChannelId: 'rid-pending', type: 'individual', status: 'pending' },
        { rcChannelId: 'rid-cancelled', type: 'individual', status: 'cancelled' },
        { rcChannelId: 'rid-nostatus', type: 'individual' },
      ],
      [],
    );
    expect(map).toEqual({});
  });

  it('keeps a DM and an appointment as separate rooms', () => {
    const map = chatTargetsByRid(
      ['rid-dm'],
      [{ rcChannelId: 'rid-appt', type: 'individual', status: 'active' }],
      [],
    );
    expect(map).toEqual({ 'rid-dm': 'dm', 'rid-appt': 'appointment' });
  });

  it('omits a room the user has no chat for, so no dead notification is shown', () => {
    // An orphaned Rocket.Chat room: it holds unread messages but no list can open it.
    const map = chatTargetsByRid(['rid-dm'], [{ rcChannelId: 'rid-sem', type: 'seminar' }], []);
    expect(map['rid-orphan']).toBeUndefined();
    expect(Object.keys(map).sort()).toEqual(['rid-dm', 'rid-sem']);
  });

  it('picks up communities known only from the community list endpoint', () => {
    expect(chatTargetsByRid([], [], ['rid-extra'])).toEqual({ 'rid-extra': 'community' });
  });

  it('keeps a direct message as a dm even when a group chat repeats the room id', () => {
    const map = chatTargetsByRid(['rid-shared'], [{ rcChannelId: 'rid-shared', type: 'seminar' }], ['rid-shared']);
    expect(map['rid-shared']).toBe('dm');
  });

  it('collapses every occurrence of a recurring seminar onto its shared room', () => {
    const occurrences = [
      { rcChannelId: 'rid-series', type: 'seminar' },
      { rcChannelId: 'rid-series', type: 'seminar' },
      { rcChannelId: 'rid-series', type: 'seminar' },
    ];
    expect(chatTargetsByRid([], occurrences, [])).toEqual({ 'rid-series': 'seminar' });
  });

  it('ignores chats with no room id and unknown types', () => {
    const map = chatTargetsByRid(
      [''],
      [{ type: 'seminar' }, { rcChannelId: '  ', type: 'community' }, { rcChannelId: 'rid-x', type: 'mystery' }],
      [''],
    );
    expect(map).toEqual({});
  });

  it('survives missing inputs', () => {
    expect(chatTargetsByRid(null, null, null)).toEqual({});
    expect(chatTargetsByRid(undefined, [null, undefined], undefined)).toEqual({});
  });
});
