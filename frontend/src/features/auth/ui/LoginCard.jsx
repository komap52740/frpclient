import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";

export default function LoginCard({
  requiresSetup,
  error,
  success,
  children,
  title = "",
  subtitle = "",
}) {
  const headingId = "auth-login-heading";
  const subtitleId = "auth-login-subtitle";
  const errorId = "auth-login-error";
  const successId = "auth-login-success";
  const describedBy = [subtitleId, error ? errorId : "", success ? successId : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Paper
      id="auth-login-card"
      component="section"
      aria-labelledby={headingId}
      aria-describedby={describedBy}
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 3.5,
        p: { xs: 2.1, md: 3.1 },
        border: "1px solid rgba(126,171,232,0.34)",
        background:
          "linear-gradient(165deg, rgba(24,37,69,0.97) 0%, rgba(15,27,53,0.96) 55%, rgba(9,18,39,0.98) 100%)",
        boxShadow: "0 24px 56px rgba(0,0,0,0.42)",
        backdropFilter: "blur(10px)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(360px 220px at 100% -15%, rgba(92,163,255,0.24) 0%, rgba(92,163,255,0) 62%), radial-gradient(320px 180px at -5% 110%, rgba(26,169,127,0.16) 0%, rgba(26,169,127,0) 66%)",
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(138,192,255,0.14) 0%, rgba(167,212,255,0.62) 50%, rgba(138,192,255,0.14) 100%)",
          pointerEvents: "none",
        },
      }}
    >
      <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography
            id={headingId}
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 30, md: 40 },
              lineHeight: 1.05,
              letterSpacing: -0.4,
              fontFamily: "'Manrope', 'Segoe UI', sans-serif",
              color: "#f2f8ff",
            }}
          >
            {title || (requiresSetup ? "Первичная настройка" : "Вход в систему")}
          </Typography>
          {!requiresSetup ? (
            <Chip
              label="Безопасный вход"
              sx={{
                color: "#d9ecff",
                border: "1px solid rgba(118,173,255,0.52)",
                bgcolor: "rgba(79,138,235,0.18)",
                fontWeight: 700,
                borderRadius: 1.2,
              }}
            />
          ) : null}
        </Stack>

        <Typography id={subtitleId} sx={{ color: "rgba(204,221,244,0.82)", fontSize: 14.2 }}>
          {subtitle ||
            (requiresSetup
              ? "Создайте первого администратора для запуска платформы."
              : "Авторизация через Google, Яндекс, VK, Telegram или логин/пароль.")}
        </Typography>

        {error ? (
          <Alert
            id={errorId}
            severity="error"
            role="alert"
            aria-live="assertive"
            sx={{
              borderRadius: 1.6,
              border: "1px solid rgba(255, 129, 129, 0.28)",
              bgcolor: "rgba(78, 25, 26, 0.78)",
            }}
          >
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert
            id={successId}
            severity="success"
            role="status"
            aria-live="polite"
            sx={{
              borderRadius: 1.6,
              border: "1px solid rgba(116, 220, 165, 0.28)",
              bgcolor: "rgba(17, 56, 39, 0.76)",
            }}
          >
            {success}
          </Alert>
        ) : null}

        {children}
      </Stack>
    </Paper>
  );
}
