import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ThemeProvider } from "./theme/theme";
import { I18nProvider } from "./i18n/i18n";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found.");
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
