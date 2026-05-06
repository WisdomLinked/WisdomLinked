import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readNginx(rel: string): string {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("nginx SPA cache strategy (index.html vs /assets/)", () => {
  for (const file of ["nginx.conf", "nginx.local.conf"] as const) {
    describe(file, () => {
      const conf = readNginx(file);

      it("declares server-level root for static files", () => {
        expect(conf).toMatch(/^\s*root\s+\/usr\/share\/nginx\/html\s*;/m);
      });

      it("serves index.html with no-store so deploys are picked up without manual cache clear", () => {
        expect(conf).toMatch(/location\s*=\s*\/index\.html\s*\{/);
        expect(conf).toMatch(/Cache-Control[^\n]*no-store/i);
        expect(conf).toMatch(/must-revalidate/i);
      });

      it("caches fingerprinted Vite assets under /assets/ with long immutable TTL", () => {
        expect(conf).toMatch(/location\s+\/assets\/\s*\{/);
        expect(conf).toMatch(/immutable/i);
        expect(conf).toMatch(/max-age=31536000/i);
      });

      it("keeps SPA fallback via try_files to index.html", () => {
        expect(conf).toMatch(/try_files\s+\$uri\s+\$uri\/\s*\/index\.html\s*;/);
      });
    });
  }
});
