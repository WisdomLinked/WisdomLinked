import { describe, expect, it } from 'vitest';
import { membershipNotice, parseCommunityGroupRealtimeMessage, rewriteStaleCommunitySlugMessage } from './communityChatMessages';
import { toRocketChatUsername } from './rocketchatUsername';

const priya = { _id: 'u1', username: 'Priya', email: 'priya@example.com' };
const slug = toRocketChatUsername(priya.email);
const group = (type: string) => ({ type, participants: [priya] });

describe('membership lines in group chats', () => {
  it.each([
    ['community', 'Priya has joined the community.', 'Priya has left the community.'],
    ['seminar', 'Priya has joined the seminar.', 'Priya has left the seminar.'],
    ['individual', 'Priya has joined the 1:1 appointment.', 'Priya has left the 1:1 appointment.'],
  ])('a live join or leave in a %s names that kind of chat', (type, joined, left) => {
    expect(parseCommunityGroupRealtimeMessage(slug, group(type), 'uj')).toEqual({ content: joined, type: 'wl-community-sys' });
    expect(parseCommunityGroupRealtimeMessage(slug, group(type), 'ul')).toEqual({ content: left, type: 'wl-community-sys' });
  });

  it('an ordinary message is left alone', () => {
    expect(parseCommunityGroupRealtimeMessage('hello there', group('seminar'), undefined)).toEqual({ content: 'hello there', type: 'message' });
  });

  it('missing chat details keep the community wording', () => {
    expect(membershipNotice('Sam', 'join')).toBe('Sam has joined the community.');
  });

  it('the stale-slug repair still only applies to communities', () => {
    const message = { content: slug, wlRcSubtype: 'uj', author: { username: 'rocket.cat' } };
    expect(rewriteStaleCommunitySlugMessage(message, group('seminar'))).toBe(message);
    expect(rewriteStaleCommunitySlugMessage(message, group('community')).content).toBe('Priya has joined the community.');
  });
});
