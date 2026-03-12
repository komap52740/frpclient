import { alpha } from "@mui/material/styles";

export const accessibleFocusRingSx = {
  outline: "none",
  "&:focus-visible": {
    outline: "none",
    boxShadow: (theme) =>
      `0 0 0 3px ${alpha(
        theme.palette.mode === "dark" ? "#d7ebff" : theme.palette.primary.main,
        theme.palette.mode === "dark" ? 0.3 : 0.26
      )}`,
  },
};

export const accessibleFocusRingInsetSx = {
  outline: "none",
  "&:focus-visible": {
    outline: "none",
    boxShadow: (theme) =>
      `0 0 0 2px ${alpha(
        theme.palette.mode === "dark" ? "#d7ebff" : theme.palette.primary.main,
        theme.palette.mode === "dark" ? 0.34 : 0.3
      )} inset`,
  },
};
