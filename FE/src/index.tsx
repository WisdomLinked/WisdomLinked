import React from 'react';
import { BrowserRouter } from "react-router-dom";
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { store } from './store';
import { Provider } from 'react-redux';
import * as serviceWorker from './serviceWorker';
import process from 'process';
import { Buffer } from 'buffer';

import { createRoot } from 'react-dom/client';

if (!window.Buffer) {
  window.Buffer = Buffer;
}

if (!window.process) {
  window.process = process;
}

// ── Security: suppress console output in production ──────────────────────────
// This ensures no sensitive user data (payloads, tokens, profile info) leaks
// through the browser developer console when the app is deployed.
if (process.env.NODE_ENV !== 'development') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // Keep console.warn and console.error for critical production diagnostics
}
// ─────────────────────────────────────────────────────────────────────────────

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
