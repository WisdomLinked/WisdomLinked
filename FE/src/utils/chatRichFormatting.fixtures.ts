/** Realistic ReactQuill HTML samples matching the messenger toolbar formats. */
export type RichFormattingSample = {
  id: string;
  label: string;
  quillHtml: string;
  /** When true, BE should store plain text (no __WL_HTML__ wire). */
  expectPlainStorage?: boolean;
  /** Substring that must survive sanitize + wire round-trip. */
  textIncludes: string;
  /** DOM tag expected when rendered (lowercase). */
  renderTag?: string;
  /** Extra selector that must exist after render. */
  renderSelector?: string;
};

export const RICH_FORMATTING_SAMPLES: RichFormattingSample[] = [
  {
    id: "plain",
    label: "plain single paragraph",
    quillHtml: "<p>hello world</p>",
    expectPlainStorage: true,
    textIncludes: "hello world",
  },
  {
    id: "bold",
    label: "bold",
    quillHtml: "<p><strong>bold text</strong></p>",
    textIncludes: "bold text",
    renderTag: "strong",
  },
  {
    id: "italic",
    label: "italic",
    quillHtml: "<p><em>italic text</em></p>",
    textIncludes: "italic text",
    renderTag: "em",
  },
  {
    id: "underline",
    label: "underline",
    quillHtml: "<p><u>underline text</u></p>",
    textIncludes: "underline text",
    renderTag: "u",
  },
  {
    id: "strike",
    label: "strikethrough",
    quillHtml: "<p><s>strike text</s></p>",
    textIncludes: "strike text",
    renderTag: "s",
  },
  {
    id: "color",
    label: "text color",
    quillHtml: '<p><span style="color: rgb(230, 0, 0);">red text</span></p>',
    textIncludes: "red text",
    renderTag: "span",
  },
  {
    id: "background",
    label: "background highlight",
    quillHtml: '<p><span style="background-color: rgb(255, 255, 0);">highlight</span></p>',
    textIncludes: "highlight",
    renderTag: "span",
  },
  {
    id: "ordered-list",
    label: "ordered list",
    quillHtml: '<ol><li data-list="ordered">first</li><li data-list="ordered">second</li></ol>',
    textIncludes: "first",
    renderSelector: 'li[data-list="ordered"]',
  },
  {
    id: "bullet-list",
    label: "bullet list",
    quillHtml: '<ol><li data-list="bullet">alpha</li><li data-list="bullet">beta</li></ol>',
    textIncludes: "alpha",
    renderSelector: 'li[data-list="bullet"]',
  },
  {
    id: "align-center",
    label: "center align",
    quillHtml: '<p class="ql-align-center">centered line</p>',
    textIncludes: "centered line",
    renderSelector: "p.ql-align-center",
  },
  {
    id: "align-right",
    label: "right align",
    quillHtml: '<p class="ql-align-right">right line</p>',
    textIncludes: "right line",
    renderSelector: "p.ql-align-right",
  },
  {
    id: "header-h2",
    label: "header",
    quillHtml: "<h2>section title</h2>",
    textIncludes: "section title",
    renderTag: "h2",
  },
  {
    id: "link",
    label: "hyperlink",
    quillHtml: '<p><a href="https://example.com">example link</a></p>',
    textIncludes: "example link",
    renderTag: "a",
  },
  {
    id: "multi-paragraph",
    label: "multi paragraph",
    quillHtml: "<p>line one</p><p>line two</p>",
    textIncludes: "line one",
  },
  {
    id: "combined",
    label: "combined formatting",
    quillHtml:
      '<p><strong>bold</strong> and <em>italic</em></p><ol><li data-list="ordered">item</li></ol>',
    textIncludes: "bold",
    renderTag: "strong",
  },
];
