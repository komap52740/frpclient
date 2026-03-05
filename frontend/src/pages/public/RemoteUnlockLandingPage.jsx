import { Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const STEPS = [
  {
    title: "1. Онлайн-заявка",
    text: "Укажите модель устройства и коротко опишите проблему. Без лишних анкет и долгих форм.",
  },
  {
    title: "2. Связь с мастером",
    text: "Вся коммуникация идет в чате заявки. Вы видите статусы и ключевые действия в реальном времени.",
  },
  {
    title: "3. Удаленная работа",
    text: "Подключение выполняется через RuDesktop. После завершения доступна история действий по заявке.",
  },
];

export default function RemoteUnlockLandingPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(1100px 640px at -5% -15%, rgba(70,145,255,0.18) 0%, rgba(6,11,23,0) 55%), radial-gradient(800px 540px at 105% 0%, rgba(49,189,142,0.16) 0%, rgba(6,11,23,0) 58%), linear-gradient(170deg, #050a14 0%, #071225 46%, #060d1c 100%)",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.4, md: 4.5 },
            borderRadius: 4,
            border: "1px solid rgba(122,171,255,0.24)",
            background:
              "linear-gradient(145deg, rgba(11,21,43,0.94) 0%, rgba(8,15,30,0.96) 62%, rgba(7,12,24,0.98) 100%)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.46)",
          }}
        >
          <Stack spacing={2.1}>
            <Chip
              label="FRP Client"
              sx={{
                alignSelf: "flex-start",
                color: "#dbedff",
                fontWeight: 800,
                border: "1px solid rgba(126,181,255,0.44)",
                bgcolor: "rgba(66,129,235,0.2)",
              }}
            />

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 30, md: 52 },
                fontWeight: 900,
                lineHeight: 1.02,
                color: "#f3f9ff",
                letterSpacing: -0.7,
              }}
            >
              Удаленная разблокировка устройств
            </Typography>

            <Typography sx={{ color: "rgba(206,226,252,0.87)", fontSize: { xs: 15, md: 19 }, maxWidth: 900 }}>
              Сервис для клиентов и сервисных центров: онлайн-заявка, чат с мастером, прозрачные этапы и понятный контроль
              процесса в одном интерфейсе.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                sx={{
                  minHeight: 50,
                  px: 2.4,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: 16,
                  borderRadius: 2.2,
                  background: "linear-gradient(135deg, #77b6ff 0%, #4a89ff 45%, #326ede 100%)",
                }}
              >
                Войти в кабинет
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                sx={{
                  minHeight: 50,
                  px: 2.4,
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: 16,
                  borderRadius: 2.2,
                  borderColor: "rgba(142,190,255,0.72)",
                  color: "#c7e4ff",
                }}
              >
                Создать заявку
              </Button>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 1.2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                pt: 1.2,
              }}
            >
              {STEPS.map((step) => (
                <Paper
                  key={step.title}
                  elevation={0}
                  sx={{
                    p: 1.6,
                    borderRadius: 2.4,
                    border: "1px solid rgba(119,166,236,0.3)",
                    bgcolor: "rgba(12,23,46,0.72)",
                  }}
                >
                  <Typography sx={{ color: "#e5f2ff", fontWeight: 800, fontSize: 15.5 }}>{step.title}</Typography>
                  <Typography sx={{ color: "rgba(205,224,247,0.86)", mt: 0.7, lineHeight: 1.45, fontSize: 14.2 }}>
                    {step.text}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
