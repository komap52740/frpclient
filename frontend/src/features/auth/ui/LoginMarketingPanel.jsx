import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

import { LANDING_CASE_ITEMS, LANDING_PRICE_ITEMS, LOGIN_FAQ_ITEMS } from "./authStyles";

export default function LoginMarketingPanel({ onScrollToLogin }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 5,
        minHeight: { xs: 240, md: "100%" },
        p: { xs: 2.4, md: 4.4 },
        border: "1px solid rgba(122,171,255,0.24)",
        background:
          "linear-gradient(145deg, rgba(12,21,43,0.92) 0%, rgba(8,14,30,0.95) 58%, rgba(7,12,24,0.98) 100%)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.46)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(560px 300px at 85% -10%, rgba(92,160,255,0.26) 0%, rgba(92,160,255,0) 62%), radial-gradient(420px 220px at -10% 100%, rgba(22,191,134,0.20) 0%, rgba(22,191,134,0) 60%)",
          pointerEvents: "none",
        },
      }}
    >
      <Stack spacing={2.2} sx={{ position: "relative", zIndex: 1 }}>
        <Chip
          label="FRP Client Premium"
          sx={{
            alignSelf: "flex-start",
            color: "rgba(220,239,255,0.95)",
            bgcolor: "rgba(80,145,255,0.18)",
            border: "1px solid rgba(122,171,255,0.45)",
            fontWeight: 800,
            letterSpacing: 0.25,
          }}
        />

        <Typography
          sx={{ fontSize: { xs: 30, md: 46 }, lineHeight: 1.05, fontWeight: 900, color: "#f7fbff" }}
        >
          Разблокировка устройств
          <Box component="span" sx={{ color: "#84d4ff", display: "block" }}>
            без визита в сервис
          </Box>
        </Typography>

        <Typography
          sx={{ color: "rgba(210,228,250,0.84)", fontSize: { xs: 14, md: 17 }, maxWidth: 620 }}
        >
          Онлайн-заявка, диалог с мастером и прозрачные статусы в одном интерфейсе. Вы всегда
          понимаете, что происходит на каждом этапе: проверка, оплата, работа, завершение.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gap: 1.15,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          {[
            {
              title: "01. Заявка",
              text: "Укажите модель, проблему и данные RuDesktop. Без лишних полей.",
            },
            {
              title: "02. Работа",
              text: "Мастер ведет заявку через чат и статусы, без скрытых этапов.",
            },
            {
              title: "03. Результат",
              text: "После завершения доступна история действий и быстрый отзыв.",
            },
          ].map((item) => (
            <Box
              key={item.title}
              sx={{
                p: 1.35,
                borderRadius: 2.2,
                border: "1px solid rgba(126,174,255,0.32)",
                background:
                  "linear-gradient(150deg, rgba(20,34,67,0.84) 0%, rgba(13,24,47,0.78) 100%)",
              }}
            >
              <Typography sx={{ fontWeight: 800, color: "#ddedff", fontSize: 14 }}>
                {item.title}
              </Typography>
              <Typography
                sx={{ color: "rgba(202,220,246,0.82)", fontSize: 13, mt: 0.65, lineHeight: 1.42 }}
              >
                {item.text}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            p: 1.4,
            borderRadius: 2.2,
            border: "1px solid rgba(120,170,255,0.28)",
            background: "rgba(10,20,40,0.74)",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 0.9 }}
          >
            <Typography sx={{ fontWeight: 800, color: "#d6e9ff" }}>Прозрачный прайс</Typography>
            <Typography sx={{ color: "rgba(190,214,245,0.74)", fontSize: 12.6 }}>
              Финальная стоимость фиксируется до начала работ
            </Typography>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 0.9,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
            }}
          >
            {LANDING_PRICE_ITEMS.map((item) => (
              <Box
                key={item.title}
                sx={{
                  p: 1.05,
                  borderRadius: 1.8,
                  border: "1px solid rgba(118,164,236,0.26)",
                  background: "rgba(11,22,44,0.66)",
                }}
              >
                <Typography sx={{ color: "#e0efff", fontWeight: 700, fontSize: 13.2 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ color: "#9ed0ff", fontWeight: 800, mt: 0.35, fontSize: 14.2 }}>
                  {item.price}
                </Typography>
                <Typography sx={{ color: "rgba(206,224,248,0.8)", fontSize: 12.5, mt: 0.2 }}>
                  {item.eta}
                </Typography>
                <Typography sx={{ color: "rgba(196,216,242,0.75)", fontSize: 12.1, mt: 0.35 }}>
                  {item.note}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            p: 1.4,
            borderRadius: 2.2,
            border: "1px solid rgba(120,170,255,0.28)",
            background: "rgba(10,20,40,0.74)",
          }}
        >
          <Typography sx={{ fontWeight: 800, color: "#d6e9ff", mb: 0.85 }}>
            Примеры работ
          </Typography>
          <Stack spacing={0.75}>
            {LANDING_CASE_ITEMS.map((item) => (
              <Box
                key={`${item.device}-${item.issue}`}
                sx={{
                  p: 0.95,
                  borderRadius: 1.7,
                  border: "1px solid rgba(118,164,236,0.26)",
                  background: "rgba(11,22,44,0.66)",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1.5fr 1.3fr auto" },
                  gap: 0.8,
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography sx={{ color: "#e0efff", fontWeight: 700, fontSize: 13 }}>
                    {item.device}
                  </Typography>
                  <Typography sx={{ color: "rgba(201,221,246,0.82)", fontSize: 12.3 }}>
                    {item.issue}
                  </Typography>
                </Box>
                <Typography sx={{ color: "rgba(206,224,248,0.84)", fontSize: 12.4 }}>
                  {item.result}
                </Typography>
                <Chip
                  size="small"
                  label={item.finalPrice}
                  sx={{
                    justifySelf: { xs: "flex-start", sm: "flex-end" },
                    color: "#dff0ff",
                    bgcolor: "rgba(77,142,244,0.28)",
                    border: "1px solid rgba(130,183,255,0.5)",
                    fontWeight: 700,
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            p: 1.4,
            borderRadius: 2.2,
            border: "1px solid rgba(120,170,255,0.28)",
            background: "rgba(11,22,42,0.72)",
          }}
        >
          <Typography sx={{ fontWeight: 800, color: "#d6e9ff", mb: 0.65 }}>
            Что нужно для старта
          </Typography>
          <Box
            component="ul"
            sx={{
              m: 0,
              pl: 2.4,
              color: "rgba(206,224,250,0.84)",
              fontSize: 13.5,
              lineHeight: 1.54,
            }}
          >
            <li>модель устройства и описание проблемы;</li>
            <li>логин/ID и пароль RuDesktop для подключения;</li>
            <li>подтверждение оплаты в карточке заявки.</li>
          </Box>
        </Box>

        <Box
          sx={{
            p: 1.4,
            borderRadius: 2.2,
            border: "1px solid rgba(120,170,255,0.28)",
            background: "rgba(10,19,38,0.72)",
          }}
        >
          <Typography sx={{ fontWeight: 800, color: "#d6e9ff", mb: 0.9 }}>
            Частые вопросы
          </Typography>
          <Stack spacing={0.9}>
            {LOGIN_FAQ_ITEMS.map((item) => (
              <Box
                key={item.question}
                sx={{
                  p: 1,
                  borderRadius: 1.7,
                  border: "1px solid rgba(118,164,236,0.26)",
                  background: "rgba(11,22,44,0.66)",
                }}
              >
                <Typography sx={{ color: "#e0efff", fontWeight: 700, fontSize: 13.3 }}>
                  {item.question}
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(202,220,246,0.85)",
                    fontSize: 12.9,
                    lineHeight: 1.45,
                    mt: 0.4,
                  }}
                >
                  {item.answer}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Button
          variant="outlined"
          onClick={onScrollToLogin}
          sx={{
            alignSelf: "flex-start",
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 800,
            borderColor: "rgba(132,179,255,0.66)",
            color: "#b7dbff",
            px: 2,
            "&:hover": {
              borderColor: "rgba(158,198,255,0.95)",
              background: "rgba(86,146,255,0.10)",
            },
          }}
        >
          Перейти ко входу
        </Button>
      </Stack>
    </Paper>
  );
}
