import { describe, expect, it } from "vitest";
import {
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

  it("peels stacked reply quotes in order", () => {
    const html =
      '<blockquote><strong>Replying to Bob</strong><br>first</blockquote>' +
      '<blockquote><strong>Replying to You</strong><br>second line</blockquote>' +
      "<p>final</p>";
    const { quotes, bodyHtml } = peelWisdomLinkedReplyQuotesRegex(html);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].to).toBe("Bob");
    expect(quotes[1].to).toBe("You");
    expect(quotes[1].excerpt).toBe("second line");
    expect(bodyHtml.trim()).toBe("<p>final</p>");
  });

  it("flattenReplyTextForNextQuote strips blockquotes and tags", () => {
    const messy = '<blockquote><strong>Replying to X</strong><br>a</blockquote><p>tail</p>';
    expect(flattenReplyTextForNextQuote(messy)).toBe("tail");
  });
});
