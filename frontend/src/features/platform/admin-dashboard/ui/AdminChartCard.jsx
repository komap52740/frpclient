import { Paper, Stack, Typography } from "@mui/material";

export default function AdminChartCard({ title, subtitle, action = null, children }) {
  return (
    <Paper sx={{ p: 2, height: "100%", borderRadius: 2 }}>
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack spacing={0.35}>
            <Typography variant="h3">{title}</Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {action}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
