/**
 * WL-SEARCH-002 loader. search.controller requires this module.
 * Heading strings live in FE/src/content/publicPages.ts so the React pages
 * render the same copy. Deploy copies that file to ./publicPageCatalog.ts
 * because the backend image build context is BE/ only.
 */
function loadCatalog(): { searchPublicPages: (query: unknown) => unknown } {
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

const { searchPublicPages } = loadCatalog();

module.exports = { searchPublicPages };
