import { alpha, createTheme } from "@mui/material/styles";

import { appTokens } from "./tokens";

export function createAppTheme(mode = "light") {
  const isDark = mode === "dark";
  const colors = isDark ? appTokens.colorsDark : appTokens.colors;

  return createTheme({
    spacing: 8,
    shape: {
      borderRadius: appTokens.radius.md,
    },
    palette: {
      mode,
      primary: {
        main: colors.brand,
        dark: colors.brandStrong,
        contrastText: "#ffffff",
      },
      secondary: {
        main: colors.accent,
        contrastText: "#ffffff",
      },
      error: {
        main: colors.danger,
      },
      success: {
        main: colors.success,
      },
      warning: {
        main: colors.warning,
      },
      info: {
        main: colors.info,
      },
      background: {
        default: colors.bg,
        paper: colors.bgElevated,
      },
      text: {
        primary: colors.textMain,
        secondary: colors.textMuted,
      },
      divider: colors.borderSoft,
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
        color: colors.textMuted,
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
        color: colors.textMuted,
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
            background: isDark
              ? "radial-gradient(1200px 620px at -10% -30%, #10233f 0%, #0a111f 45%, #060a12 100%)"
              : "radial-gradient(1200px 560px at -10% -20%, #e9f3ff 0%, #f5f7fb 40%, #f2f2f7 100%)",
            color: colors.textMain,
            textRendering: "geometricPrecision",
          },
          "::selection": {
            background: isDark ? alpha(colors.brand, 0.45) : alpha(colors.brand, 0.22),
          },
          "@keyframes frpPageEnter": {
            "0%": { opacity: 0, transform: "translateY(10px) scale(0.996)" },
            "100%": { opacity: 1, transform: "translateY(0px) scale(1)" },
          },
          "::-webkit-scrollbar": {
            width: 9,
            height: 9,
          },
          "::-webkit-scrollbar-thumb": {
            backgroundColor: isDark ? "rgba(124,140,164,0.42)" : "rgba(71,85,105,0.26)",
            borderRadius: 999,
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
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
            border: `1px solid ${colors.borderSoft}`,
            boxShadow: appTokens.shadows.card,
            backgroundColor: colors.bgElevated,
            backgroundImage: "none",
            backdropFilter: "blur(18px) saturate(130%)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: appTokens.radius.lg,
            border: `1px solid ${colors.borderSoft}`,
            boxShadow: appTokens.shadows.card,
            backgroundColor: isDark ? alpha("#0f172a", 0.8) : "rgba(255,255,255,0.88)",
            backdropFilter: "blur(14px) saturate(125%)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha("#0f172a", 0.82) : "rgba(255,255,255,0.72)",
            color: colors.textMain,
            borderBottom: `1px solid ${colors.borderSoft}`,
            boxShadow: isDark ? "0 6px 30px rgba(2, 6, 23, 0.45)" : "0 4px 24px rgba(15, 23, 42, 0.07)",
            backdropFilter: "blur(18px) saturate(140%)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: appTokens.radius.lg,
            backgroundColor: isDark ? alpha("#111827", 0.94) : "rgba(255,255,255,0.92)",
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
            backgroundColor: isDark ? alpha("#0f172a", 0.72) : "#ffffff",
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: colors.brand,
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
}

export const appTheme = createAppTheme("light");
export { appTokens };
