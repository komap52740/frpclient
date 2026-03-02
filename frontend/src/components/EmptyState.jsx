import { Box, Button, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export default function EmptyState({ title, description, actionLabel, onAction }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Paper
      sx={{
        p: { xs: 2.2, md: 4 },
        textAlign: "center",
        borderRadius: 3,
        background: isDark
          ? "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(17,26,41,0.86) 100%)"
          : "linear-gradient(180deg, #ffffff 0%, #f7faf9 100%)",
      }}
    >
      <Box sx={{ maxWidth: 560, mx: "auto" }}>
        <Typography variant="h6" mb={1}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
        {actionLabel && onAction ? (
          <Button variant="contained" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </Box>
    </Paper>
  );
}
