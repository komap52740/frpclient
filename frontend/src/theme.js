import { createTheme } from "@mui/material";

export const appTheme = createTheme({
  palette: {
    primary: {
      main: "#0f766e",
      light: "#2a9d8f",
      dark: "#0c5b55",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#ef6c00",
      light: "#ff8f00",
      dark: "#c43e00",
      contrastText: "#ffffff",
    },
    info: {
      main: "#1565c0",
    },
    background: {
      default: "#f4f8f7",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", "Arial", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: -0.5,
    },
    h5: {
      fontWeight: 780,
      letterSpacing: -0.35,
    },
    h6: {
      fontWeight: 740,
      letterSpacing: -0.25,
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: "radial-gradient(circle at top right, #eef8f6 0%, #f6f9f7 45%, #eef3f8 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 10px 24px rgba(18, 49, 66, 0.06)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 10px 22px rgba(9, 30, 66, 0.08)",
        },
      },
    },
  },
});
