import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { brandConfig } from "../../../shared/config/brandConfig";
import WholesaleLayout from "../ui/WholesaleLayout";

const BRAND_PRINCIPLES = [
  {
    title: "Контроль",
    description:
      "SLA, статусы и операционные действия должны считываться за один взгляд без лишнего визуального шума.",
    icon: VerifiedRoundedIcon,
  },
  {
    title: "Скорость",
    description:
      "Интерфейс должен ощущаться рабочим инструментом сервисного центра, а не витринной страницей с декоративными блоками.",
    icon: BoltRoundedIcon,
  },
  {
    title: "Доверие",
    description:
      "Тон, цвет и support-сигналы должны транслировать управляемый процесс и живую линию партнёрской поддержки.",
    icon: ShieldRoundedIcon,
  },
];

const RELEASE_SCOPE = [
  "Зафиксировать имя партнёрского кабинета и короткие подписи во всех hero-блоках B2B-контура.",
  "Подготовить отдельный комплект логотипов: favicon, иконки приложения, бейдж уведомлений и партнёрский lockup для презентаций.",
  "Собрать правила палитры для основных действий, предупреждений, успеха и SLA-состояний, чтобы статусы не спорили между собой.",
  "Выделить отдельную лексику для поддержки, заказов и профиля, чтобы B2B-раздел не звучал как клиентский кабинет.",
  "Добавлять фоновые графические материалы только там, где они усиливают доверие, а не перегружают рабочий экран.",
];

const ROLLOUT_STEPS = [
  "Утвердить визуальную ось: имя, логотип, акцентный цвет и тон коммуникации для партнёрского продукта.",
  "Пройти обзор, заказы и профиль на предмет общих формулировок и выровнять все экраны под единый B2B-тон.",
  "Подключить финальные графические материалы, проверить favicon, manifest и браузерные уведомления и выпустить контур как отдельный продукт FRP.",
];

function BrandPrincipleCard({ title, description, icon: IconComponent }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.4,
        borderRadius: 2,
        borderColor: "divider",
        bgcolor: "rgba(15, 23, 42, 0.22)",
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha("#2563eb", 0.14),
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          <IconComponent sx={{ fontSize: 20 }} />
        </Box>
        <Stack spacing={0.35}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function IdentityStat({ label, value, tone = "default" }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.4,
        borderRadius: 2,
        borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.04)",
      }}
    >
      <Stack spacing={0.35}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: tone === "accent" ? brandConfig.accent : "text.primary",
          }}
        >
          {value}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function WholesaleBrandingPage() {
  return (
    <WholesaleLayout
      title="Фирменная система партнёрского кабинета"
      subtitle="B2B-контур FRP должен ощущаться как отдельный рабочий продукт: строгий интерфейс, ясные статусы, быстрый доступ к заказам и живая линия поддержки для сервисных центров, дилеров и партнёрских команд."
      action={
        <Button component={RouterLink} to="/wholesale" variant="contained" color="inherit">
          К обзору B2B
        </Button>
      }
    >
      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Paper
            sx={{
              p: 2.2,
              borderRadius: 2,
              color: "#fff",
              background: `
                radial-gradient(circle at top right, ${alpha("#fff", 0.14)} 0%, transparent 34%),
                linear-gradient(145deg, ${brandConfig.accent} 0%, #17326c 46%, #08142e 100%)
              `,
            }}
          >
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.8}
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Box
                  sx={{
                    width: 88,
                    height: 88,
                    borderRadius: 3,
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                    overflow: "hidden",
                    bgcolor: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    boxShadow: "0 20px 40px rgba(2, 6, 23, 0.26)",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      inset: 10,
                      borderRadius: 2.5,
                      border: "1px solid rgba(255,255,255,0.14)",
                    },
                  }}
                >
                  <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "0.08em" }}>
                    FRP
                  </Typography>
                  <Box
                    sx={{
                      position: "absolute",
                      right: 14,
                      top: 14,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "#7dd3fc",
                      boxShadow: "0 0 0 6px rgba(125, 211, 252, 0.18)",
                    }}
                  />
                </Box>

                <Stack spacing={0.65}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label="Релиз 1.0"
                      sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "#fff" }}
                    />
                    <Chip
                      size="small"
                      label="Фирменный контур"
                      sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "#fff" }}
                    />
                  </Stack>
                  <Typography variant="h3">FRP Партнёрский кабинет</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.92, maxWidth: 560 }}>
                    Тёмная база, холодный электрический акцент и короткие деловые подписи без
                    технической лексики. Такой стиль считывается как операционный B2B-продукт, а не
                    как временная сборка.
                  </Typography>
                </Stack>
              </Stack>

              <Grid container spacing={1.2}>
                <Grid item xs={12} sm={4}>
                  <IdentityStat label="Имя продукта" value={brandConfig.name} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <IdentityStat label="Accent" value={brandConfig.accent} tone="accent" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <IdentityStat label="Линия партнёров" value={brandConfig.supportTelegram} />
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2.2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.4}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PaletteRoundedIcon sx={{ color: brandConfig.accent }} />
                <Typography variant="h3">Опорные принципы бренда</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Партнёрский кабинет должен выглядеть как быстрый и надёжный рабочий инструмент для
                сервисных центров. Ниже три сигнала, которые экран обязан транслировать с первого
                взгляда.
              </Typography>
              {BRAND_PRINCIPLES.map((item) => (
                <BrandPrincipleCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                />
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SupportAgentRoundedIcon color="primary" />
                <Typography variant="h3">Что фиксируем к релизу 1.0</Typography>
              </Stack>
              {RELEASE_SCOPE.map((item) => (
                <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: brandConfig.accent,
                      mt: 0.8,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {item}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RocketLaunchRoundedIcon color="warning" />
                <Typography variant="h3">План выката бренда</Typography>
              </Stack>
              {ROLLOUT_STEPS.map((item, index) => (
                <Stack key={item} direction="row" spacing={1.2} alignItems="flex-start">
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={`Шаг ${index + 1}`}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {item}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </WholesaleLayout>
  );
}
