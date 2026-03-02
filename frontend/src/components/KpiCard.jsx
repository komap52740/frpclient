import { Paper, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export default function KpiCard({ title, value, caption = "", accent = "#15616d" }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        background: isDark
          ? "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(20,30,46,0.85) 100%)"
          : "linear-gradient(135deg, #ffffff 0%, #f4faf9 100%)",
        border: "1px solid",
        borderColor: isDark ? "divider" : `${accent}22`,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ color: accent, lineHeight: 1.1 }}>
          {value}
        </Typography>
        {caption ? (
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
