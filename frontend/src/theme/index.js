import { createTheme } from "@mui/material/styles";

import { appTokens } from "./tokens";

export const appTheme = createTheme({
  spacing: 8,
  shape: {
    borderRadius: appTokens.radius.md,
  },
  palette: {
    mode: "light",
    primary: {
      main: appTokens.colors.brand,
      dark: appTokens.colors.brandStrong,
      contrastText: "#ffffff",
    },
    secondary: {
      main: appTokens.colors.accent,
      contrastText: "#ffffff",
    },
    error: {
      main: appTokens.colors.danger,
    },
    success: {
      main: appTokens.colors.success,
    },
    warning: {
      main: appTokens.colors.warning,
    },
    info: {
      main: appTokens.colors.info,
    },
    background: {
      default: appTokens.colors.bg,
      paper: appTokens.colors.bgElevated,
    },
    text: {
      primary: appTokens.colors.textMain,
      secondary: appTokens.colors.textMuted,
    },
    divider: appTokens.colors.borderSoft,
  },
  typography: {
    fontFamily: appTokens.typography.fontFamily,
    h1: {
      fontSize: appTokens.typography.h1,
      lineHeight: 1.1,
      fontWeight: 820,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontSize: appTokens.typography.h2,
      lineHeight: 1.15,
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontSize: appTokens.typography.h3,
      lineHeight: 1.2,
      fontWeight: 760,
      letterSpacing: "-0.015em",
    },
    h4: {
      fontSize: "1.125rem",
      lineHeight: 1.25,
      fontWeight: 760,
      letterSpacing: "-0.012em",
    },
    body1: {
      fontSize: appTokens.typography.body,
      lineHeight: 1.5,
      fontWeight: 500,
    },
    body2: {
      fontSize: "0.88rem",
      lineHeight: 1.45,
      color: appTokens.colors.textMuted,
      fontWeight: 500,
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
      letterSpacing: "-0.005em",
    },
    caption: {
      fontSize: appTokens.typography.caption,
      lineHeight: 1.35,
      color: appTokens.colors.textMuted,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": {
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        body: {
          background:
            "radial-gradient(1200px 560px at -10% -20%, #e9f3ff 0%, #f5f7fb 40%, #f2f2f7 100%)",
        },
        "#root": {
          minHeight: "100vh",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.sm,
          minHeight: 42,
          paddingInline: 18,
          transition: "all 220ms ease",
        },
        containedPrimary: {
          boxShadow: appTokens.shadows.soft,
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: appTokens.shadows.raised,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.md,
          border: `1px solid ${appTokens.colors.borderSoft}`,
          boxShadow: appTokens.shadows.card,
          backgroundColor: appTokens.colors.bgElevated,
          backgroundImage: "none",
          backdropFilter: "blur(18px) saturate(130%)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.lg,
          border: `1px solid ${appTokens.colors.borderSoft}`,
          boxShadow: appTokens.shadows.card,
          backgroundColor: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(14px) saturate(125%)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.72)",
          color: appTokens.colors.textMain,
          borderBottom: `1px solid ${appTokens.colors.borderSoft}`,
          boxShadow: "0 4px 24px rgba(15, 23, 42, 0.07)",
          backdropFilter: "blur(18px) saturate(140%)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: appTokens.radius.lg,
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(18px) saturate(130%)",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.sm,
          backgroundColor: "#ffffff",
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: appTokens.colors.brand,
            boxShadow: appTokens.shadows.focus,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.pill,
          fontWeight: 700,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          borderRadius: appTokens.radius.sm,
        },
      },
    },
  },
});

export { appTokens };
