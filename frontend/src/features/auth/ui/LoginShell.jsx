import { Box } from "@mui/material";

import LoginMarketingPanel from "./LoginMarketingPanel";

export default function LoginShell({ children }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 1.5, md: 3.5 },
        py: { xs: 2, md: 3.5 },
        fontFamily: "Manrope, 'Segoe UI', system-ui, sans-serif",
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(64,153,255,0.24) 0%, rgba(8,16,33,0) 45%), radial-gradient(900px 620px at 110% 0%, rgba(22,191,134,0.18) 0%, rgba(8,16,33,0) 45%), linear-gradient(160deg, #050912 0%, #071025 45%, #040812 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1220,
          mx: "auto",
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
        }}
      >
        <LoginMarketingPanel
          onScrollToLogin={() =>
            document
              .getElementById("auth-login-card")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        {children}
      </Box>
    </Box>
  );
}
