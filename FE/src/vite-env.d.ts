/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_HOST_URL: string
  readonly VITE_TURN_URL: string
  readonly VITE_BASE_URL: string
  readonly VITE_AUTH_URL: string
  readonly VITE_PAYPAL_TEST_CLIENT_ID: string
  readonly VITE_PAYPAL_REAL_CLIENT_ID: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY_TEST: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY_LIVE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: typeof process;
  }
}

