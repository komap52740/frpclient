import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import { Alert, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link as RouterLink } from "react-router-dom";

import { wholesalePortalApi } from "../../../api/client";
import { getStatusLabel } from "../../../constants/labels";
import { brandConfig } from "../../../shared/config/brandConfig";
import {
  getWholesalePriorityMeta,
  getWholesaleStatusMeta,
  presentWholesaleValue,
} from "../lib/portalLabels";
import { buildWholesaleReadiness, getWholesaleSupportLink } from "../lib/readiness";
import WholesaleLayout from "../ui/WholesaleLayout";
import WholesaleReadinessPanel from "../ui/WholesaleReadinessPanel";

function SummaryCard({ label, value, tone = "default" }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Stack spacing={0.35}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          variant="h3"
          color={
            tone === "success"
              ? "success.main"
              : tone === "warning"
                ? "warning.main"
                : "text.primary"
          }
        >
          {value}
        </Typography>
      </Stack>
    </Paper>
  );
}

function formatMoney(amount, currency = "RUB") {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "Цена уточняется";
  }
  return `${numericAmount.toLocaleString("ru-RU")} ${currency || "RUB"}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD.MM.YYYY HH:mm");
}

function FocusCard({ icon: IconComponent, label, value, description, actionLabel, to, href }) {
  const linkProps = href
    ? {
        component: "a",
        href,
        target: "_blank",
        rel: "noreferrer",
      }
    : {
        component: RouterLink,
        to,
      };

  return (
    <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Stack spacing={1.2} height="100%">
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent color="primary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h3">{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {description}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon />}
          {...linkProps}
        >
          {actionLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

export default function WholesaleHomePage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["wholesale", "summary"],
    queryFn: async () => {
      const response = await wholesalePortalApi.summary();
      return response.data;
    },
  });

  const wholesale = data?.wholesale || {};
  const counts = data?.counts || {};
  const latestOrder = data?.latest_order || null;
  const readiness = buildWholesaleReadiness(wholesale);
  const statusMeta = getWholesaleStatusMeta(wholesale.wholesale_status);
  const priorityMeta = getWholesalePriorityMeta(wholesale.wholesale_priority);
  const supportLink = getWholesaleSupportLink();
  const nextStep = (() => {
    if (readiness.isOperational) {
      return {
        value: "Линия активна",
        description: readiness.description,
        actionLabel: "Открыть очередь",
        to: "/wholesale/orders",
      };
    }
    return {
      value: readiness.title,
      description: readiness.description,
      actionLabel: readiness.primaryAction.label,
      to: readiness.primaryAction.to,
    };
  })();

  return (
    <WholesaleLayout
      title="Партнёрский кабинет"
      subtitle="Операционный обзор компании: очередь заявок, модерация, текущая нагрузка и быстрый доступ к рабочим кейсам B2B-линии."
      action={
        <Button component={RouterLink} to="/client/profile" variant="contained" color="inherit">
          Редактировать реквизиты
        </Button>
      }
    >
      {error ? <Alert severity="error">Не удалось загрузить B2B-панель.</Alert> : null}
      {isPending ? <Alert severity="info">Загрузка B2B-панели...</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="Всего B2B-кейсов" value={counts.orders_total ?? "-"} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="В работе" value={counts.orders_active ?? "-"} tone="success" />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="Завершено" value={counts.orders_completed ?? "-"} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="Ждут оплату" value={counts.awaiting_payment ?? "-"} tone="warning" />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="SLA-риск" value={counts.orders_problematic ?? "-"} tone="warning" />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <SummaryCard label="Новые сообщения" value={counts.unread_total ?? "-"} />
        </Grid>
      </Grid>

      {!readiness.isOperational ? <WholesaleReadinessPanel wholesale={wholesale} /> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StorefrontRoundedIcon color="primary" />
                <Typography variant="h3">Карточка компании</Typography>
              </Stack>
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
                  label={`Город: ${presentWholesaleValue(wholesale.wholesale_city, "Не указан")}`}
                />
              </Stack>
              <Typography variant="body2">
                Компания: <b>{presentWholesaleValue(wholesale.wholesale_company_name)}</b>
              </Typography>
              <Typography variant="body2">
                Адрес: <b>{presentWholesaleValue(wholesale.wholesale_address)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusMeta.guidance}
              </Typography>
              {wholesale.wholesale_review_comment ? (
                <Typography variant="body2" color="text.secondary">
                  Комментарий модерации: {wholesale.wholesale_review_comment}
                </Typography>
              ) : null}
              {wholesale.wholesale_priority_note ? (
                <Typography variant="body2" color="text.secondary">
                  Комментарий к приоритету: {wholesale.wholesale_priority_note}
                </Typography>
              ) : null}
              <Button
                component={RouterLink}
                to="/wholesale/profile"
                variant="outlined"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Открыть карточку компании
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1}>
              <Typography variant="h3">Последняя активность</Typography>
              {latestOrder ? (
                <>
                  <Typography variant="body2">
                    Заказ <b>#{latestOrder.id}</b> •{" "}
                    {presentWholesaleValue(latestOrder.brand, "Устройство")}{" "}
                    {presentWholesaleValue(latestOrder.model, "")}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={getStatusLabel(latestOrder.status)}
                    />
                    <Chip
                      size="small"
                      color={latestOrder.unread_count ? "primary" : "default"}
                      variant="outlined"
                      label={`Новые сообщения: ${latestOrder.unread_count || 0}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={formatMoney(latestOrder.total_price, latestOrder.currency)}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Последнее сообщение:{" "}
                    {presentWholesaleValue(latestOrder.latest_message_text, "Диалог пока пуст")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Обновлён: {formatDateTime(latestOrder.updated_at)}
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={`/appointments/${latestOrder.id}`}
                    variant="contained"
                  >
                    Открыть заказ
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {readiness.isOperational
                    ? "Партнёрских кейсов пока нет. Как только новая заявка войдёт в B2B-маршрут, она появится здесь."
                    : readiness.queueHint}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <FocusCard
            icon={ForumRoundedIcon}
            label="Коммуникации"
            value={counts.unread_total ?? 0}
            description={
              counts.unread_total
                ? "В очереди есть непрочитанные сообщения. Лучше закрыть эти диалоги первыми, чтобы не копить ручные эскалации."
                : readiness.isOperational
                  ? "Непрочитанных сообщений нет. Очередь по коммуникациям сейчас под контролем."
                  : "Коммуникации появятся здесь, когда первые кейсы действительно попадут в B2B-маршрут."
            }
            actionLabel="Открыть заказы"
            to="/wholesale/orders"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FocusCard
            icon={PlaylistAddCheckRoundedIcon}
            label="Следующий шаг"
            value={nextStep.value}
            description={nextStep.description}
            actionLabel={nextStep.actionLabel}
            to={nextStep.to}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FocusCard
            icon={SupportAgentRoundedIcon}
            label="Партнёрская поддержка"
            value={brandConfig.supportTelegram}
            description="Используйте этот канал для SLA-вопросов, ручной эскалации кейсов и координации по нестандартным заказам."
            actionLabel="Открыть поддержку"
            href={supportLink}
          />
        </Grid>
      </Grid>
    </WholesaleLayout>
  );
}
