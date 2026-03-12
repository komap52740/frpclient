import { Alert, Chip, Divider, Grid, Paper, Stack, Typography } from "@mui/material";

import { getLockTypeLabel } from "../../../../../constants/labels";

function formatMinutes(minutes) {
  if (minutes < 60) {
    return `~${minutes} мин`;
  }
  const hours = Math.ceil(minutes / 60);
  return `~${hours} ч`;
}

export default function ReviewSubmitStep({ form, timingEstimate }) {
  return (
    <Stack spacing={1.6}>
      <Stack spacing={0.4}>
        <Typography variant="h6">Шаг 3. Проверка перед отправкой</Typography>
        <Typography variant="body2" color="text.secondary">
          Ниже итог по заявке. После отправки вы сразу попадете в карточку и сможете продолжить в
          чате.
        </Typography>
      </Stack>

      <Grid container spacing={1.2}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 1.8, borderRadius: 1.4, height: "100%" }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Что уйдет мастеру
              </Typography>
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                <Chip
                  label={
                    `${form.brand || "—"} ${form.model || ""}`.trim() || "Устройство не указано"
                  }
                />
                <Chip label={getLockTypeLabel(form.lock_type)} />
                <Chip
                  color={form.has_pc ? "success" : "warning"}
                  label={form.has_pc ? "ПК готов" : "Нет ПК"}
                />
              </Stack>
              <Divider />
              <Typography variant="body2">
                <b>ID RuDesktop:</b> {form.rustdesk_id || "не указан"}
              </Typography>
              <Typography variant="body2">
                <b>Пароль RuDesktop:</b> {form.rustdesk_password ? "указан" : "не указан"}
              </Typography>
              <Typography variant="body2">
                <b>Фото экрана:</b>{" "}
                {form.photo_lock_screen ? form.photo_lock_screen.name : "не прикреплено"}
              </Typography>
              <Typography variant="body2">
                <b>Описание:</b> {form.description?.trim() || "краткое описание не добавлено"}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 1.8, borderRadius: 1.4, height: "100%" }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Оценка готовности
              </Typography>
              <Alert severity={timingEstimate.confidence === "Высокая" ? "success" : "info"}>
                Чем полнее данные сейчас, тем меньше пауз на уточнения после создания заявки.
              </Alert>
              <Typography variant="body2">
                <b>Ориентир по первому ответу:</b> {formatMinutes(timingEstimate.responseMinutes)}
              </Typography>
              <Typography variant="body2">
                <b>Ориентир по выполнению:</b> {formatMinutes(timingEstimate.completionMinutes)}
              </Typography>
              <Typography variant="body2">
                <b>Уверенность прогноза:</b> {timingEstimate.confidence}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Это предварительная оценка по полноте данных и типу блокировки. Финальный SLA
                зависит от очереди и назначения мастера.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {!form.has_pc ? (
        <Alert severity="warning">
          Без ПК заявку отправлять рано: мастер не сможет подключиться удаленно. Вернитесь на первый
          шаг и подтвердите готовность ПК.
        </Alert>
      ) : null}
    </Stack>
  );
}
