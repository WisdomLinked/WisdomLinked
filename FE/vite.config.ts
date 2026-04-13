import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 3000,
        },
        define: {
            'process.env': env
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        // React core — cached separately, rarely changes
                        'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit'],
                        // MUI — heavy, only used in dashboard
                        'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
                        // Real-time & video (using DDP and Jitsi APIs directly)
                        // Payments
                        'payment-vendor': ['@stripe/stripe-js', '@stripe/react-stripe-js', '@paypal/react-paypal-js'],
                    }
                }
            }
        }
    };
});
