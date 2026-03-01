import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { ThemeProvider } from "./themes/ThemeProvider";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error(
    "[WisdomLinked] Root element #root not found in the DOM. " +
      "Ensure index.html contains <div id=\"root\"></div>.",
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

