import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as publicPages from './publicPages';
import {
    PUBLIC_PAGES,
    PUBLIC_ROUTES,
    searchPublicPages,
} from './publicPages';

const PAGE_FILES: { file: string; route: (typeof PUBLIC_ROUTES)[number]; stripModals?: boolean }[] = [
    { file: 'TOEConsulting.tsx', route: '/', stripModals: true },
    { file: 'AboutUS.tsx', route: '/aboutus' },
    { file: 'Services.tsx', route: '/services' },
    { file: 'Ruels.tsx', route: '/rules' },
    { file: 'ContactUS.tsx', route: '/contactus' },
];

const FORBIDDEN = ['Student sign up', 'Expert sign up', 'Welcome back', 'Lorem ipsum', 'Full Name', 'Main message'];

function stripBlockComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripHomeModals(source: string): string {
    const start = source.indexOf('function ContactFormModal');
    const end = source.indexOf('function GlobeCanvas');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('could not locate TOEConsulting modal region');
    }
    return source.slice(0, start) + source.slice(end);
}

function bindImports(source: string): Record<string, unknown> {
    const mod = publicPages as Record<string, unknown>;
    const bindings: Record<string, unknown> = {};
    const re = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]*publicPages['"]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
        for (const part of match[1].split(',')) {
            const bits = part.trim().split(/\s+as\s+/);
            const exported = bits[0]?.trim();
            const local = (bits[1] || bits[0])?.trim();
            if (!exported || !local || !(exported in mod)) continue;
            bindings[local] = mod[exported];
        }
    }
    return bindings;
}

function resolveExpr(expr: string, bindings: Record<string, unknown>): string {
    const trimmed = expr.trim();
    if (
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
        || (trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
        return trimmed.slice(1, -1);
    }
    const parts = trimmed.split('.');
    let cur: unknown = bindings;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object' || !(part in (cur as Record<string, unknown>))) {
            return `{${trimmed}}`;
        }
        cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === 'string' ? cur : `{${trimmed}}`;
}

function jsxToText(inner: string, bindings: Record<string, unknown>): string {
    const withoutTags = inner
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '');
    const withExprs = withoutTags.replace(/\{([^{}]+)\}/g, (_, expr) => resolveExpr(String(expr), bindings));
    return withExprs
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function publicHeadings(source: string, bindings: Record<string, unknown>): string[] {
    const headings: string[] = [];
    const re = /<h([12])\b[^>]*>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
        const close = `</h${match[1]}>`;
        const start = re.lastIndex;
        const end = source.indexOf(close, start);
        if (end < 0) break;
        const text = jsxToText(source.slice(start, end), bindings);
        if (text) headings.push(text);
        re.lastIndex = end + close.length;
    }
    return headings;
}

function normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

describe('public page index', () => {
    it('indexes only the five public routes', () => {
        expect(PUBLIC_PAGES.length).toBeGreaterThan(0);
        for (const row of PUBLIC_PAGES) {
            expect(PUBLIC_ROUTES).toContain(row.route);
            expect(Object.keys(row).sort()).toEqual(['route', 'snippet', 'title']);
            expect(row.title.length).toBeGreaterThan(0);
            expect(row.snippet.length).toBeGreaterThan(0);
            for (const forbidden of FORBIDDEN) {
                expect(row.title.toLowerCase().includes(forbidden.toLowerCase())).toBe(false);
                expect(row.snippet.toLowerCase().includes(forbidden.toLowerCase())).toBe(false);
            }
        }
    });

    it('fails when a public h1 or h2 changes and the index does not contain it', () => {
        const pagesDir = path.resolve(__dirname, '../pages');
        for (const spec of PAGE_FILES) {
            const raw = readFileSync(path.join(pagesDir, spec.file), 'utf8');
            const source = stripBlockComments(spec.stripModals ? stripHomeModals(raw) : raw);
            const headings = publicHeadings(source, bindImports(raw));
            expect(headings.length, spec.file).toBeGreaterThan(0);
            const indexed = PUBLIC_PAGES.filter((row) => row.route === spec.route).map((row) => normalize(row.title));
            for (const heading of headings) {
                expect(indexed, `${spec.file} heading missing from index: ${heading}`).toContain(normalize(heading));
            }
            for (const title of indexed) {
                expect(headings.map(normalize), `${spec.file} does not render indexed heading: ${title}`).toContain(title);
            }
        }
    });

    it('matches a trimmed literal query of length >= 2 against title and snippet', () => {
        expect(searchPublicPages('')).toEqual([]);
        expect(searchPublicPages(' a ')).toEqual([]);
        expect(searchPublicPages('a.')).toEqual([]);
        expect(searchPublicPages('.*')).toEqual([]);
        expect(searchPublicPages('sign up')).toEqual([]);
        expect(searchPublicPages('lorem')).toEqual([]);

        const made = searchPublicPages('  MADE IT  ');
        expect(made.some((row) => row.route === '/' && row.title.includes("made it."))).toBe(true);

        const study = searchPublicPages('Study Abroad');
        expect(study.some((row) => row.route === '/services' && row.snippet.includes('Study Abroad'))).toBe(true);
        expect(study.some((row) => row.route === '/login')).toBe(false);

        const broad = searchPublicPages('the');
        expect(broad.length).toBeGreaterThan(5);
        for (const row of broad) {
            expect(PUBLIC_ROUTES).toContain(row.route);
        }
    });
});
