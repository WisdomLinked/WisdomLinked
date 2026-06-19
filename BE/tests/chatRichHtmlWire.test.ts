import test from 'node:test';
import assert from 'node:assert/strict';
import {
    decodeRichHtmlWire,
    encodeRichHtmlWire,
    hasRichHtmlMarkup,
    isRichHtmlWire,
    WL_HTML_WIRE_PREFIX,
} from '../utils/chatRichHtmlWire';
import { prepareMessageForRocketChat } from '../utils/chatReplyPlainText';

test('hasRichHtmlMarkup detects bold and plain paragraphs', () => {
    assert.equal(hasRichHtmlMarkup('<p>hello</p>'), false);
    assert.equal(hasRichHtmlMarkup('<p><strong>hello</strong></p>'), true);
});

test('encodeRichHtmlWire round-trips sanitized HTML', () => {
    const html = '<p><strong>Hello</strong></p>';
    const wire = encodeRichHtmlWire(html);
    assert.ok(isRichHtmlWire(wire));
    assert.equal(decodeRichHtmlWire(wire), html);
});

test('prepareMessageForRocketChat preserves rich formatting via wire format', () => {
    const html = '<p><strong>Hello</strong> <em>world</em></p>';
    const out = prepareMessageForRocketChat(html);
    assert.ok(out.startsWith(`${WL_HTML_WIRE_PREFIX}|`));
    assert.equal(decodeRichHtmlWire(out), html);
});

test('prepareMessageForRocketChat still strips plain HTML without formatting', () => {
    const out = prepareMessageForRocketChat('<p>plain text</p>');
    assert.equal(out, 'plain text');
});
