import test from 'node:test';
import assert from 'node:assert/strict';
import { wlHtmlToPlainTextForRocketChat } from '../services/rocketchat.service';

test('wlHtmlToPlainTextForRocketChat preserves __MEETING_CHAT__ line', () => {
    const line = '__MEETING_CHAT__::507f1f77bcf86cd799439011::eyJ2IjoxfQ';
    assert.equal(wlHtmlToPlainTextForRocketChat(line), line);
});

test('wlHtmlToPlainTextForRocketChat preserves __MEETING_STARTED__ line', () => {
    const line = '__MEETING_STARTED__::a::room::Bob';
    assert.equal(wlHtmlToPlainTextForRocketChat(line), line);
});
