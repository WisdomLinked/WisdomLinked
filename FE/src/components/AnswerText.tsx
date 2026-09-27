import React from 'react';

type ParagraphBlock = { type: 'p'; lines: string[] };
type ListBlock = { type: 'ul' | 'ol'; items: string[] };
type Block = ParagraphBlock | ListBlock;

const BULLET_LINE = /^[-*] (.*)$/;
const NUMBERED_LINE = /^\d+\. (.*)$/;

function parseBlocks(text: string): Block[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '') {
            index += 1;
            continue;
        }

        const bullet = line.match(BULLET_LINE);
        if (bullet) {
            const items: string[] = [];
            while (index < lines.length) {
                const match = lines[index].match(BULLET_LINE);
                if (!match) break;
                items.push(match[1]);
                index += 1;
            }
            blocks.push({ type: 'ul', items });
            continue;
        }

        const numbered = line.match(NUMBERED_LINE);
        if (numbered) {
            const items: string[] = [];
            while (index < lines.length) {
                const match = lines[index].match(NUMBERED_LINE);
                if (!match) break;
                items.push(match[1]);
                index += 1;
            }
            blocks.push({ type: 'ol', items });
            continue;
        }

        const paragraph: string[] = [];
        while (
            index < lines.length &&
            lines[index].trim() !== '' &&
            !BULLET_LINE.test(lines[index]) &&
            !NUMBERED_LINE.test(lines[index])
        ) {
            paragraph.push(lines[index]);
            index += 1;
        }
        blocks.push({ type: 'p', lines: paragraph });
    }

    return blocks;
}

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let plain = '';
    let index = 0;

    const flush = (key: string) => {
        if (!plain) return;
        nodes.push(<React.Fragment key={key}>{plain}</React.Fragment>);
        plain = '';
    };

    const linkMatchAt = (start: number): { url: string; length: number } | null => {
        // Markdown [label](https://...)
        if (text.startsWith('[', start)) {
            const labelEnd = text.indexOf(']', start + 1);
            if (labelEnd !== -1 && text[labelEnd + 1] === '(') {
                const urlEnd = text.indexOf(')', labelEnd + 2);
                if (urlEnd !== -1) {
                    const url = text.slice(labelEnd + 2, urlEnd).trim();
                    if (/^https?:\/\//i.test(url)) {
                        return { url, length: urlEnd + 1 - start };
                    }
                }
            }
        }
        // Bare https://...
        const rest = text.slice(start);
        const bare = rest.match(/^https?:\/\/[^\s<>)"']+/i);
        if (bare) {
            return { url: bare[0].replace(/[.,;:!?)]+$/, ''), length: bare[0].length };
        }
        return null;
    };

    while (index < text.length) {
        if (text[index] === '`') {
            const end = text.indexOf('`', index + 1);
            if (end !== -1) {
                flush(`${keyPrefix}-t-${index}`);
                nodes.push(
                    <code key={`${keyPrefix}-c-${index}`} className="break-words">
                        {text.slice(index + 1, end)}
                    </code>,
                );
                index = end + 1;
                continue;
            }
        }

        if (text.startsWith('**', index)) {
            const end = text.indexOf('**', index + 2);
            if (end !== -1) {
                flush(`${keyPrefix}-t-${index}`);
                nodes.push(
                    <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
                        {parseInline(text.slice(index + 2, end), `${keyPrefix}-b-${index}`)}
                    </strong>,
                );
                index = end + 2;
                continue;
            }
        }

        if (text[index] === '*') {
            const end = text.indexOf('*', index + 1);
            if (end > index + 1) {
                flush(`${keyPrefix}-t-${index}`);
                nodes.push(
                    <em key={`${keyPrefix}-i-${index}`}>
                        {parseInline(text.slice(index + 1, end), `${keyPrefix}-i-${index}`)}
                    </em>,
                );
                index = end + 1;
                continue;
            }
        }

        const link = linkMatchAt(index);
        if (link) {
            flush(`${keyPrefix}-t-${index}`);
            const label =
                text.startsWith('[', index) && text.indexOf(']', index) !== -1
                    ? text.slice(index + 1, text.indexOf(']', index))
                    : link.url;
            nodes.push(
                <a
                    key={`${keyPrefix}-a-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words font-medium text-[#234C6A] underline underline-offset-2"
                >
                    {label}
                </a>,
            );
            index += link.length;
            continue;
        }

        plain += text[index];
        index += 1;
    }

    flush(`${keyPrefix}-t-end`);
    return nodes;
}

function lineNodes(lines: string[], id: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    lines.forEach((line, index) => {
        if (index > 0) nodes.push(<br key={`${id}-br-${index}`} />);
        nodes.push(...parseInline(line, `${id}-${index}`));
    });
    return nodes;
}

function ListBlockView({ block, id }: { block: ListBlock; id: string }) {
    const Tag = block.type;
    const marker = block.type === 'ul' ? 'list-disc' : 'list-decimal';
    return (
        <Tag className={`my-1 space-y-1 break-words pl-5 ${marker}`}>
            {block.items.map((item, index) => (
                <li key={`${id}-${index}`} className="break-words">
                    {parseInline(item, `${id}-${index}`)}
                </li>
            ))}
        </Tag>
    );
}

export default function AnswerText({ text, className }: { text: string; className?: string }) {
    const blocks = parseBlocks(text ?? '');
    const rootClass = [className, 'min-w-0 break-words', className ? '' : 'max-w-full', blocks.length > 1 ? 'space-y-2' : '']
        .filter(Boolean)
        .join(' ');
    const singleParagraph = blocks.length === 1 && blocks[0].type === 'p' ? blocks[0] : null;

    return (
        <div className={rootClass}>
            {singleParagraph
                ? lineNodes(singleParagraph.lines, 'p')
                : blocks.map((block, index) =>
                      block.type === 'p' ? (
                          <p key={`p-${index}`} className="break-words">
                              {lineNodes(block.lines, `p-${index}`)}
                          </p>
                      ) : (
                          <ListBlockView key={`${block.type}-${index}`} block={block} id={`${block.type}-${index}`} />
                      ),
                  )}
        </div>
    );
}
