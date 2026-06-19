import React from "react";
import parse, { domToReact, Element, HTMLReactParserOptions, DOMNode } from "html-react-parser";

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br"]);
const BLOCKED_TAGS = new Set(["iframe", "object", "script", "style"]);
const SAFE_SPAN_STYLE_PROPS = new Set(["color", "background-color"]);

const escapeText = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function filterSafeSpanStyle(raw: string): string {
  const parts: string[] = [];
  for (const chunk of String(raw || "").split(";")) {
    const idx = chunk.indexOf(":");
    if (idx < 0) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (!SAFE_SPAN_STYLE_PROPS.has(prop) || !value) continue;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.join("; ");
}

function filterSafeQuillClass(raw: string): string {
  return String(raw || "")
    .split(/\s+/)
    .filter((token) => /^ql-align-(center|right|justify)$/.test(token) || /^ql-indent-\d+$/.test(token))
    .join(" ");
}

function safeElementAttrs(element: HTMLElement, tag: string): string {
  let attrs = "";
  if (tag === "span") {
    const safeStyle = filterSafeSpanStyle(element.getAttribute("style") || "");
    if (safeStyle) attrs += ` style="${escapeText(safeStyle)}"`;
  }
  if (tag === "p" || tag === "li") {
    const safeClass = filterSafeQuillClass(element.getAttribute("class") || "");
    if (safeClass) attrs += ` class="${escapeText(safeClass)}"`;
  }
  if (tag === "li") {
    const listKind = element.getAttribute("data-list");
    if (listKind === "bullet" || listKind === "ordered") {
      attrs += ` data-list="${listKind}"`;
    }
  }
  return attrs;
}

export function isSafeMessageHref(raw: unknown): boolean {
  const href = String(raw ?? "").trim();
  if (!href) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function anchorProps(attribs: Record<string, string | undefined>) {
  const href = String(attribs.href ?? "").trim();
  if (!isSafeMessageHref(href)) return {};
  return {
    href,
    target: "_blank",
    rel: "noopener noreferrer nofollow",
    title: attribs.title,
  };
}

export function sanitizeMessageHtml(html: string | undefined | null): string {
  const cleaned = String(html || "").replace(
    /<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1>|<(script|style|iframe|object)\b[^>]*\/?>/gi,
    "",
  );

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return escapeText(cleaned);
  }

  const doc = new window.DOMParser().parseFromString(`<div>${cleaned}</div>`, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) return "";
    const children = Array.from(element.childNodes).map(walk).join("");
    if (tag === "body" || tag === "div" && element.parentElement === doc.body) return children;
    if (!ALLOWED_TAGS.has(tag)) return children;
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      const safeHref = isSafeMessageHref(href) ? ` href="${escapeText(href)}" target="_blank" rel="noopener noreferrer nofollow"` : "";
      return `<a${safeHref}>${children}</a>`;
    }
    if (tag === "span") {
      const safeStyle = filterSafeSpanStyle(element.getAttribute("style") || "");
      return safeStyle
        ? `<span style="${escapeText(safeStyle)}">${children}</span>`
        : `<span>${children}</span>`;
    }
    const attrs = safeElementAttrs(element, tag);
    return `<${tag}${attrs}>${children}</${tag}>`;
  };

  return Array.from(doc.body.childNodes).map(walk).join("").trim();
}

export function renderSafeMessageHtml(html: string | undefined | null): React.ReactNode {
  let options: HTMLReactParserOptions;
  options = {
    replace: (node: DOMNode) => {
      if (node.type !== "tag") return undefined;

      const element = node as Element;
      const tag = element.name.toLowerCase();
      if (BLOCKED_TAGS.has(tag)) return <></>;
      if (!ALLOWED_TAGS.has(tag)) {
        return <>{domToReact(element.children as DOMNode[], options)}</>;
      }

      const props =
        tag === "a"
          ? anchorProps(element.attribs ?? {})
          : tag === "span" && element.attribs?.style
            ? { style: filterSafeSpanStyle(element.attribs.style) }
            : tag === "p" || tag === "li"
              ? {
                  ...(element.attribs?.class
                    ? { className: filterSafeQuillClass(element.attribs.class) }
                    : {}),
                  ...(tag === "li" &&
                  (element.attribs?.["data-list"] === "bullet" ||
                    element.attribs?.["data-list"] === "ordered")
                    ? { "data-list": element.attribs["data-list"] }
                    : {}),
                }
              : {};
      if (VOID_TAGS.has(tag)) {
        return React.createElement(tag, props);
      }
      return React.createElement(tag, props, domToReact(element.children as DOMNode[], options));
    },
  };

  return parse(sanitizeMessageHtml(html), options);
}
