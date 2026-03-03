import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

const toneStyles = {
  default: { light: { bg: "#f7fafc", accent: "#0d6e9f" }, dark: { bg: "#152235", accent: "#8dc8ff" } },
  success: { light: { bg: "#eefaf3", accent: "#1c9a4d" }, dark: { bg: "#163428", accent: "#7be3a7" } },
  warning: { light: { bg: "#fff8ea", accent: "#b8740f" }, dark: { bg: "#3a2a12", accent: "#ffd186" } },
  danger: { light: { bg: "#fdeff0", accent: "#c63f38" }, dark: { bg: "#3d1c20", accent: "#ff9f98" } },
  info: { light: { bg: "#edf4ff", accent: "#2678d8" }, dark: { bg: "#172a42", accent: "#8fbfff" } },
};

export default function KpiTiles({ items = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(4, minmax(0, 1fr))",
        },
        width: "100%",
      }}
    >
      {items.map((item) => {
        const tone = toneStyles[item.tone || "default"] || toneStyles.default;
        const palette = isDark ? tone.dark : tone.light;

        return (
          <Box key={item.id || item.label} sx={{ minWidth: 0 }}>
            <Paper
              sx={{
                p: 1.5,
                borderRadius: 1.4,
                border: "1px solid",
                borderColor: alpha(palette.accent, isDark ? 0.35 : 0.22),
                background: `linear-gradient(145deg, ${alpha(palette.bg, isDark ? 0.9 : 1)} 0%, ${alpha(
                  palette.bg,
                  isDark ? 0.7 : 0.92
                )} 100%)`,
                transition: "transform 180ms ease, box-shadow 180ms ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: isDark
                    ? `0 12px 24px ${alpha("#020617", 0.45)}`
                    : `0 12px 24px ${alpha("#0f172a", 0.1)}`,
                },
              }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {item.label}
                </Typography>
                <Typography variant="h3" sx={{ color: palette.accent }}>
                  {item.value ?? "-"}
                </Typography>
                {item.hint ? (
                  <Typography variant="caption" color="text.secondary">
                    {item.hint}
                  </Typography>
                ) : null}
              </Stack>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
