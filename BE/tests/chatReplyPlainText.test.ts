import test from 'node:test';
import assert from 'node:assert/strict';
import {
    encodeReplyWireFormat,
    peelHtmlReplyQuotesRegex,
    prepareMessageForRocketChat,
    WL_REPLY_WIRE_PREFIX,
} from '../utils/chatReplyPlainText';
import { decodeRichHtmlWire, WL_HTML_WIRE_PREFIX } from '../utils/chatRichHtmlWire';

test('prepareMessageForRocketChat encodes HTML reply as wire format', () => {
    const html =
        '<blockquote class="wl-reply-quote" data-wl-reply-id="abc123"><strong>Replying to Alice</strong><br>hello there</blockquote><p>my reply</p>';
    const out = prepareMessageForRocketChat(html);
    assert.ok(out.startsWith(`${WL_REPLY_WIRE_PREFIX}|abc123|`));
    assert.ok(out.includes(encodeURIComponent('Alice')));
    assert.ok(out.includes(encodeURIComponent('hello there')));
    assert.ok(out.endsWith('my reply'));
});

test('prepareMessageForRocketChat passes through existing wire format', () => {
    const wire = `${WL_REPLY_WIRE_PREFIX}|id1|${encodeURIComponent('Bob')}|${encodeURIComponent('hi')}|\nbody`;
    assert.equal(prepareMessageForRocketChat(wire), wire);
});

test('prepareMessageForRocketChat strips normal HTML without reply', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const out = prepareMessageForRocketChat(html);
    assert.ok(out.startsWith(`${WL_HTML_WIRE_PREFIX}|`));
    assert.equal(decodeRichHtmlWire(out), html);
});

test('encodeReplyWireFormat uses pipe-delimited encoded fields', () => {
    const wire = encodeReplyWireFormat(
        { to: 'Bob', excerpt: 'line one', messageId: 'm1' },
        'answer',
    );
    assert.equal(wire, `${WL_REPLY_WIRE_PREFIX}|m1|${encodeURIComponent('Bob')}|${encodeURIComponent('line one')}|\nanswer`);
});

test('peelHtmlReplyQuotesRegex reads data-wl-reply-id', () => {
    const html =
        '<blockquote data-wl-reply-id="x1"><strong>Replying to You</strong><br>excerpt</blockquote><p>tail</p>';
    const { quotes, bodyHtml } = peelHtmlReplyQuotesRegex(html);
    assert.equal(quotes[0]?.messageId, 'x1');
    assert.equal(quotes[0]?.to, 'You');
    assert.equal(bodyHtml.trim(), '<p>tail</p>');
});
