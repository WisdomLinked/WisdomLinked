import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMessageForRocketChat } from '../utils/chatReplyPlainText';
import { decodeRichHtmlWire, hasRichHtmlMarkup, WL_HTML_WIRE_PREFIX } from '../utils/chatRichHtmlWire';

/** Keep in sync with FE/src/utils/chatRichFormatting.fixtures.ts */
const RICH_FORMATTING_SAMPLES = [
    {
        id: 'plain',
        quillHtml: '<p>hello world</p>',
        expectPlainStorage: true,
        textIncludes: 'hello world',
    },
    {
        id: 'bold',
        quillHtml: '<p><strong>bold text</strong></p>',
        textIncludes: 'bold text',
    },
    {
        id: 'italic',
        quillHtml: '<p><em>italic text</em></p>',
        textIncludes: 'italic text',
    },
    {
        id: 'underline',
        quillHtml: '<p><u>underline text</u></p>',
        textIncludes: 'underline text',
    },
    {
        id: 'strike',
        quillHtml: '<p><s>strike text</s></p>',
        textIncludes: 'strike text',
    },
    {
        id: 'color',
        quillHtml: '<p><span style="color: rgb(230, 0, 0);">red text</span></p>',
        textIncludes: 'red text',
    },
    {
        id: 'background',
        quillHtml: '<p><span style="background-color: rgb(255, 255, 0);">highlight</span></p>',
        textIncludes: 'highlight',
    },
    {
        id: 'ordered-list',
        quillHtml: '<ol><li data-list="ordered">first</li><li data-list="ordered">second</li></ol>',
        textIncludes: 'first',
    },
    {
        id: 'bullet-list',
        quillHtml: '<ol><li data-list="bullet">alpha</li><li data-list="bullet">beta</li></ol>',
        textIncludes: 'alpha',
    },
    {
        id: 'align-center',
        quillHtml: '<p class="ql-align-center">centered line</p>',
        textIncludes: 'centered line',
    },
    {
        id: 'align-right',
        quillHtml: '<p class="ql-align-right">right line</p>',
        textIncludes: 'right line',
    },
    {
        id: 'header-h2',
        quillHtml: '<h2>section title</h2>',
        textIncludes: 'section title',
    },
    {
        id: 'link',
        quillHtml: '<p><a href="https://example.com">example link</a></p>',
        textIncludes: 'example link',
    },
    {
        id: 'multi-paragraph',
        quillHtml: '<p>line one</p><p>line two</p>',
        textIncludes: 'line one',
    },
    {
        id: 'combined',
        quillHtml: '<p><strong>bold</strong> and <em>italic</em></p><ol><li data-list="ordered">item</li></ol>',
        textIncludes: 'bold',
    },
] as const;

for (const sample of RICH_FORMATTING_SAMPLES) {
    test(`rich formatting round-trip (BE): ${sample.id}`, () => {
        const stored = prepareMessageForRocketChat(sample.quillHtml);

        if (sample.expectPlainStorage) {
            assert.equal(hasRichHtmlMarkup(sample.quillHtml), false);
            assert.ok(!stored.startsWith(`${WL_HTML_WIRE_PREFIX}|`));
            assert.ok(stored.includes(sample.textIncludes));
            return;
        }

        assert.equal(hasRichHtmlMarkup(sample.quillHtml), true);
        assert.ok(stored.startsWith(`${WL_HTML_WIRE_PREFIX}|`));
        const decoded = decodeRichHtmlWire(stored);
        assert.ok(decoded?.includes(sample.textIncludes));
    });
}

test('rich reply body with formatting uses wire in reply payload', () => {
    const html =
        '<blockquote class="wl-reply-quote" data-wl-reply-id="mid1"><strong>Replying to Alice</strong><br>hi</blockquote><p><strong>formatted reply</strong></p>';
    const stored = prepareMessageForRocketChat(html);
    assert.ok(stored.startsWith('__WL_REPLY__|mid1|'));
    assert.ok(stored.includes(`${WL_HTML_WIRE_PREFIX}|`));
    assert.ok(decodeRichHtmlWire(stored.split('\n').pop() || '')?.includes('formatted reply'));
});
