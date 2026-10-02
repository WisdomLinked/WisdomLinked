function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(value: string): string {
  let out = escapeHtml(value);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    return `<a href="${href}">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

/** Convert a small markdown subset to HTML. Always pass the result through sanitize/renderSafeMessageHtml. */
export function markdownToSafeHtml(markdown: string): string {
  const lines = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      html.push('<ul>');
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        html.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*]\s+/, '').trim())}</li>`);
        i += 1;
      }
      html.push('</ul>');
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${inlineMarkdown(para.join(' '))}</p>`);
  }

  return html.join('');
}
