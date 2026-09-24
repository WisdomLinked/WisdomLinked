/**
 * WL-SEARCH-002 loader. search.controller requires this module.
 * Heading strings live in FE/src/content/publicPages.ts so the React pages
 * render the same copy. Deploy copies that file to ./publicPageCatalog.ts
 * because the backend image build context is BE/ only.
 */
function loadCatalog(): { searchPublicPages: (query: unknown) => unknown; PUBLIC_PAGES?: unknown; default?: { PUBLIC_PAGES?: unknown } } {
    const candidates = ['../../FE/src/content/publicPages', './publicPageCatalog'];
    let lastError: unknown;
    for (const id of candidates) {
        try {
            const mod = require(id);
            if (typeof mod?.searchPublicPages === 'function') return mod;
        } catch (err: any) {
            const missing = err?.code === 'MODULE_NOT_FOUND'
                || err?.code === 'ERR_MODULE_NOT_FOUND'
                || /Cannot find module/.test(String(err?.message || ''));
            if (!missing) throw err;
            lastError = err;
        }
    }
    throw lastError;
}

const catalog = loadCatalog();
const { searchPublicPages } = catalog;

/** Every indexed public page (headings, snippets, and routes), not a keyword slice. */
const allPublicPages = (): { title: string; snippet: string; route: string }[] => {
    const source = catalog.PUBLIC_PAGES ?? catalog.default?.PUBLIC_PAGES;
    if (!Array.isArray(source)) return [];
    return source.map((row: any) => ({
        title: String(row?.title ?? ''),
        snippet: String(row?.snippet ?? ''),
        route: String(row?.route ?? ''),
    }));
};

module.exports = { searchPublicPages, allPublicPages };
