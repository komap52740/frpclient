import { Box, Button, Paper, Typography } from "@mui/material";

export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Paper
      sx={{
        p: 4,
        textAlign: "center",
        borderRadius: 3,
        background: "linear-gradient(180deg, #ffffff 0%, #f7faf9 100%)",
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
