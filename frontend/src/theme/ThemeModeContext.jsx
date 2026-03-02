import { createContext, useContext } from "react";

export const ThemeModeContext = createContext({
  mode: "light",
  setMode: () => undefined,
  toggleMode: () => undefined,
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
