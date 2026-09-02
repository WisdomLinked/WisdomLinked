import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        env: {
            TZ: 'UTC',
        },
        globals: true,
        setupFiles: './src/test/setup.ts',
        // 72 jsdom environments contend for the cores, so a test that runs in under a
        // second on its own can sit unscheduled for several. At the 5s default that
        // starvation surfaced as a timeout on whichever trivial test happened to be
        // waiting — the failure moved between files run to run. A genuine hang still
        // fails, just later.
        testTimeout: 20000,
        hookTimeout: 20000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            thresholds: {
                lines: 1,
                statements: 1,
                functions: 10,
                branches: 25,
            },
        },
    },
});

