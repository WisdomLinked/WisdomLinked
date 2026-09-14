import { describe, expect, it } from 'vitest';
import { markdownToSafeHtml } from './guideMarkdown';

describe('markdownToSafeHtml', () => {
  it('renders headings, paragraphs, bullets, and links', () => {
    const html = markdownToSafeHtml(
      [
        '## Next step',
        '',
        'Read the **prompt** carefully.',
        '',
        '- Ask early',
        '- Send a [CV](https://example.com/cv.pdf)',
      ].join('\n'),
    );
    expect(html).toContain('<h2>Next step</h2>');
    expect(html).toContain('<strong>prompt</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Ask early</li>');
    expect(html).toContain('<a href="https://example.com/cv.pdf">CV</a>');
  });

  it('escapes raw HTML in the source', () => {
    const html = markdownToSafeHtml('Hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
