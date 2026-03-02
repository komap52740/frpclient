import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { createAppTheme } from "./theme";
import { ThemeModeContext } from "./theme/ThemeModeContext";

const THEME_STORAGE_KEY = "frp_theme_mode";

function resolveInitialMode() {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function Root() {
  const [mode, setMode] = useState(resolveInitialMode);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      setMode: (nextMode) => {
        const normalized = nextMode === "dark" ? "dark" : "light";
        window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
        setMode(normalized);
      },
      toggleMode: () => {
        setMode((current) => {
          const nextMode = current === "dark" ? "light" : "dark";
          window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
          return nextMode;
        });
      },
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
