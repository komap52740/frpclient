import { Box, CircularProgress, Stack, Typography } from "@mui/material";

export default function LoginLoadingScreen() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(64,153,255,0.24) 0%, rgba(8,16,33,0) 45%), radial-gradient(900px 620px at 110% 0%, rgba(22,191,134,0.18) 0%, rgba(8,16,33,0) 45%), linear-gradient(160deg, #050912 0%, #071025 45%, #040812 100%)",
        fontFamily: "Manrope, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={32} />
        <Typography color="rgba(233,244,255,0.92)">Проверяем состояние системы...</Typography>
      </Stack>
    </Box>
  );
}
