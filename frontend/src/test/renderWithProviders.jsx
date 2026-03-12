import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ThemeModeContext } from "../theme/ThemeModeContext";

export function renderWithProviders(
  ui,
  { mode = "dark", route = "/", themeModeValue = {}, ...renderOptions } = {}
) {
  const theme = createTheme({ palette: { mode } });
  const resolvedThemeModeValue = {
    mode,
    setMode: () => undefined,
    toggleMode: () => undefined,
    ...themeModeValue,
  };

  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeModeContext.Provider value={resolvedThemeModeValue}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </ThemeModeContext.Provider>
    </MemoryRouter>,
    renderOptions
  );
}
