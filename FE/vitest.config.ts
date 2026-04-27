import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
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

