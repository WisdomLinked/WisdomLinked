import { describe, expect, it } from "vitest";
import {
  buildReplyQuoteHtml,
  immediateReplyQuote,
  peelWisdomLinkedReplyQuotes,
  peelWisdomLinkedReplyQuotesRegex,
  flattenReplyTextForNextQuote,
} from "./chatReplyLayout";

describe("chatReplyLayout", () => {
  it("peelWisdomLinkedReplyQuotes matches regex helper in browser", () => {
    const html =
      '<blockquote><strong>Replying to Alice</strong><br>hello there</blockquote><p>my reply</p>';
    expect(peelWisdomLinkedReplyQuotes(html)).toEqual(peelWisdomLinkedReplyQuotesRegex(html));
  });

  it("peels one WisdomLinked reply quote and leaves body", () => {
    const html =
      '<blockquote><strong>Replying to Alice</strong><br>hello there</blockquote><p>my reply</p>';
    const { quotes, bodyHtml } = peelWisdomLinkedReplyQuotesRegex(html);
    expect(quotes).toEqual([{ to: "Alice", excerpt: "hello there" }]);
    expect(bodyHtml.trim()).toBe("<p>my reply</p>");
  });

  it("peels data-wl-reply-id from blockquote", () => {
    const html = buildReplyQuoteHtml({
      messageId: "abc123",
      authorNameEscaped: "Bob",
      excerptEscaped: "hi",
    });
    const { quotes } = peelWisdomLinkedReplyQuotesRegex(`${html}<p>reply</p>`);
    expect(quotes[0]?.messageId).toBe("abc123");
    expect(quotes[0]?.to).toBe("Bob");
  });

  it("immediateReplyQuote returns last peeled quote", () => {
    const html =
      '<blockquote><strong>Replying to Bob</strong><br>first</blockquote>' +
      '<blockquote data-wl-reply-id="id2"><strong>Replying to You</strong><br>second line</blockquote>' +
      "<p>final</p>";
    const { quotes } = peelWisdomLinkedReplyQuotesRegex(html);
    const immediate = immediateReplyQuote(quotes);
    expect(immediate?.to).toBe("You");
    expect(immediate?.excerpt).toBe("second line");
    expect(immediate?.messageId).toBe("id2");
  });

  it("flattenReplyTextForNextQuote strips blockquotes and tags", () => {
    const messy = '<blockquote><strong>Replying to X</strong><br>a</blockquote><p>tail</p>';
    expect(flattenReplyTextForNextQuote(messy)).toBe("tail");
  });
});
