import { Paper, Stack, Typography } from "@mui/material";

export default function KpiCard({ title, value, caption = "", accent = "#15616d" }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        background: "linear-gradient(135deg, #ffffff 0%, #f4faf9 100%)",
        border: `1px solid ${accent}22`,
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
