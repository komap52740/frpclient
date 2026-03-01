import { Grid, Paper, Stack, Typography } from "@mui/material";

const toneStyles = {
  default: { bg: "#f7fafc", accent: "#0d6e9f" },
  success: { bg: "#eefaf3", accent: "#1c9a4d" },
  warning: { bg: "#fff8ea", accent: "#b8740f" },
  danger: { bg: "#fdeff0", accent: "#c63f38" },
  info: { bg: "#edf4ff", accent: "#2678d8" },
};

export default function KpiTiles({ items = [] }) {
  return (
    <Grid container spacing={1.25}>
      {items.map((item) => {
        const tone = toneStyles[item.tone || "default"] || toneStyles.default;
        return (
          <Grid item xs={12} sm={6} md={3} key={item.id || item.label}>
            <Paper sx={{ p: 1.5, bgcolor: tone.bg }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {item.label}
                </Typography>
                <Typography variant="h3" sx={{ color: tone.accent }}>
                  {item.value ?? "-"}
                </Typography>
                {item.hint ? (
                  <Typography variant="caption" color="text.secondary">
                    {item.hint}
                  </Typography>
                ) : null}
              </Stack>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}
