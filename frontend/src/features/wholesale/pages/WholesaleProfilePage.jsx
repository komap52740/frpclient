import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Alert, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link as RouterLink } from "react-router-dom";

import { wholesalePortalApi } from "../../../api/client";
import { brandConfig } from "../../../shared/config/brandConfig";
import {
  getWholesalePriorityMeta,
  getWholesaleStatusMeta,
  presentWholesaleValue,
} from "../lib/portalLabels";
import WholesaleLayout from "../ui/WholesaleLayout";
import WholesaleReadinessPanel from "../ui/WholesaleReadinessPanel";

const OPERATIONS_RULES = [
  "Держите название компании, город и адрес в актуальном состоянии: это влияет на модерацию и последующие эскалации.",
  "Все SLA-вопросы и нестандартные кейсы лучше эскалировать через партнёрскую поддержку, а не ждать ответа в общем потоке.",
];

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD.MM.YYYY HH:mm");
}

export default function WholesaleProfilePage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["wholesale", "profile"],
    queryFn: async () => {
      const response = await wholesalePortalApi.profile();
      return response.data;
    },
  });

  const user = data?.user || {};
  const wholesale = data?.wholesale || {};
  const statusMeta = getWholesaleStatusMeta(wholesale.wholesale_status);
  const priorityMeta = getWholesalePriorityMeta(wholesale.wholesale_priority);
  const supportLink = brandConfig.supportTelegram?.startsWith("@")
    ? `https://t.me/${brandConfig.supportTelegram.slice(1)}`
    : `https://t.me/${brandConfig.supportTelegram || ""}`;

  return (
    <WholesaleLayout
      title="Карточка компании"
      subtitle="Реквизиты партнёра, статус модерации и текущий уровень обслуживания B2B-линии в одном экране."
      action={
        <Button
          component={RouterLink}
          to="/client/profile"
          variant="contained"
          color="inherit"
          startIcon={<EditRoundedIcon />}
        >
          Редактировать реквизиты
        </Button>
      }
    >
      {error ? <Alert severity="error">Не удалось загрузить B2B-профиль.</Alert> : null}
      {isPending ? <Alert severity="info">Загрузка B2B-профиля...</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1}>
              <Typography variant="h3">Реквизиты партнёра</Typography>
              <Typography variant="body2">
                Компания: <b>{presentWholesaleValue(wholesale.wholesale_company_name)}</b>
              </Typography>
              <Typography variant="body2">
                Город: <b>{presentWholesaleValue(wholesale.wholesale_city)}</b>
              </Typography>
              <Typography variant="body2">
                Адрес: <b>{presentWholesaleValue(wholesale.wholesale_address)}</b>
              </Typography>
              <Typography variant="body2">
                Владелец кабинета: <b>{presentWholesaleValue(user.username)}</b>
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1}>
              <Typography variant="h3">Модерация и обслуживание</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={statusMeta.chipColor}
                  variant={statusMeta.chipVariant}
                  label={`Статус: ${statusMeta.label}`}
                />
                <Chip
                  size="small"
                  color={priorityMeta.chipColor}
                  variant={priorityMeta.chipVariant}
                  label={`Приоритет: ${priorityMeta.label}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Проверил: ${presentWholesaleValue(wholesale.wholesale_verified_by_username, "Ещё не назначено")}`}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {statusMeta.guidance}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Комментарий модерации:{" "}
                {presentWholesaleValue(wholesale.wholesale_review_comment, "Пока без комментариев")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Комментарий к приоритету:{" "}
                {presentWholesaleValue(wholesale.wholesale_priority_note, "Не указано")}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1}>
              <Typography variant="h3">Таймлайн статуса</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Запрос: ${formatDateTime(wholesale.wholesale_requested_at)}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Решение: ${formatDateTime(wholesale.wholesale_reviewed_at)}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Верификация: ${formatDateTime(wholesale.wholesale_verified_at)}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Приоритет обновлён: ${formatDateTime(wholesale.wholesale_priority_updated_at)}`}
                />
              </Stack>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <WholesaleReadinessPanel wholesale={wholesale} title="Готовность B2B-контура" />
        </Grid>
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                <Stack spacing={1}>
                  <Typography variant="h3">Линия партнёрской поддержки</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Операционные вопросы по B2B-линии, SLA и маршрутизации заявок ведутся через{" "}
                    {brandConfig.supportTelegram}. Используйте этот канал, когда нужен быстрый
                    эскалейшн по партнёрскому кейсу.
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      color="info"
                      variant="outlined"
                      label={`Канал: ${brandConfig.supportTelegram}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Приоритет: ${priorityMeta.label}`}
                    />
                  </Stack>
                  <Button
                    component="a"
                    href={supportLink}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                    endIcon={<OpenInNewRoundedIcon />}
                  >
                    Открыть поддержку
                  </Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
                <Stack spacing={1}>
                  <Typography variant="h3">Рабочий регламент</Typography>
                  {OPERATIONS_RULES.map((rule) => (
                    <Stack key={rule} direction="row" spacing={1} alignItems="flex-start">
                      <Chip size="small" color="primary" variant="outlined" label="OK" />
                      <Typography variant="body2" color="text.secondary">
                        {rule}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        {wholesale.wholesale_service_photo_1_url || wholesale.wholesale_service_photo_2_url ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={1}>
                <Typography variant="h3">Материалы точки</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {wholesale.wholesale_service_photo_1_url ? (
                    <Button
                      component="a"
                      href={wholesale.wholesale_service_photo_1_url}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                    >
                      Фото точки 1
                    </Button>
                  ) : null}
                  {wholesale.wholesale_service_photo_2_url ? (
                    <Button
                      component="a"
                      href={wholesale.wholesale_service_photo_2_url}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                    >
                      Фото точки 2
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        ) : null}
      </Grid>
    </WholesaleLayout>
  );
}
