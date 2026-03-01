import AddTaskIcon from "@mui/icons-material/AddTask";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import useAutoRefresh from "../../hooks/useAutoRefresh";

dayjs.locale("ru");

const CHECKLIST_STORAGE_KEY = "frp_client_readiness_v1";

const CHECKLIST_ITEMS = [
  { key: "internet", label: "Стабильный интернет (без VPN/прокси)." },
  { key: "power", label: "ПК подключен к питанию и не уйдет в сон." },
  { key: "access", label: "Готов дать удаленный доступ по инструкции мастера." },
  { key: "backup", label: "Сделал резервную копию важных данных." },
];

const STATUS_PRIORITY = {
  AWAITING_PAYMENT: 100,
  PAYMENT_PROOF_UPLOADED: 90,
  IN_PROGRESS: 80,
  IN_REVIEW: 70,
  NEW: 60,
  PAID: 55,
  COMPLETED: 20,
  DECLINED_BY_MASTER: 10,
  CANCELLED: 5,
};

const WAITING_TIPS = {
  payment: [
    "Оплатите и сразу загрузите чек — это ускоряет старт работы мастера.",
    "Если реквизиты не копируются, откройте заявку и скопируйте вручную из блока оплаты.",
    "После загрузки чека держите чат открытым: мастер может уточнить детали.",
  ],
  review: [
    "Мастер проверяет заявку. Если есть уточнение — напишите одно короткое сообщение в чат.",
    "Проверьте готовность ПК: питание, интернет и удаленный доступ.",
    "Чем быстрее ответы в чате, тем быстрее переход к следующему шагу.",
  ],
  progress: [
    "Работа уже идет. Не закрывайте чат, чтобы не пропустить важный вопрос мастера.",
    "Если связь прервалась, сразу напишите в чат заявки — это фиксируется в истории.",
    "После завершения проверьте устройство и оставьте отзыв — это помогает качеству сервиса.",
  ],
  idle: [
    "Все ключевые действия по заявке находятся на одном экране.",
    "Фокус-заявки ниже покажут, где нужно ваше внимание прямо сейчас.",
  ],
};

function loadChecklistState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function pickPriorityAppointment(items) {
  if (!items.length) {
    return null;
  }

  const sorted = [...items].sort((a, b) => {
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) {
      return unreadDiff;
    }

    const priorityDiff = (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });

  return sorted[0];
}

function buildAppointmentLink(appointmentId, focus) {
  if (!focus) {
    return `/appointments/${appointmentId}`;
  }
  return `/appointments/${appointmentId}?focus=${focus}`;
}

function formatEtaMinutes(minutes) {
  if (minutes == null) return "";
  if (minutes <= 0) return "срок уже наступил";
  if (minutes < 60) return `~${minutes} мин`;
  return `~${Math.ceil(minutes / 60)} ч`;
}

function resolveScenario(appointment) {
  if (!appointment) {
    return {
      title: "Готовы начать новую заявку",
      helper: "Опишите устройство и проблему. Обычно заполнение занимает до 2 минут.",
      ctaLabel: "Создать заявку",
      to: "/client/create",
      tone: "#0d6e9f",
      eta: "",
      tips: WAITING_TIPS.idle,
    };
  }

  if (appointment.status === "AWAITING_PAYMENT") {
    return {
      title: `Заявка #${appointment.id}: требуется оплата`,
      helper: "Оплатите и прикрепите чек. Это самый быстрый путь к старту работ.",
      ctaLabel: "Перейти к оплате",
      to: buildAppointmentLink(appointment.id, "payment"),
      tone: "#d1890f",
      eta: "",
      tips: WAITING_TIPS.payment,
    };
  }

  if (appointment.status === "PAYMENT_PROOF_UPLOADED") {
    const responseEta = appointment.response_deadline_at
      ? dayjs(appointment.response_deadline_at).diff(dayjs(), "minute")
      : null;
    return {
      title: `Заявка #${appointment.id}: чек на проверке`,
      helper: "Проверка обычно занимает 1-5 минут. Если есть вопрос — откройте чат.",
      ctaLabel: "Открыть заявку",
      to: buildAppointmentLink(appointment.id, "chat"),
      tone: "#b8740f",
      eta: responseEta != null ? `Проверка: ${formatEtaMinutes(responseEta)}` : "Проверка: 1-5 мин",
      tips: WAITING_TIPS.payment,
    };
  }

  if (appointment.status === "IN_PROGRESS" || appointment.status === "IN_REVIEW") {
    const targetMinutes =
      appointment.status === "IN_REVIEW"
        ? appointment.response_deadline_at
          ? dayjs(appointment.response_deadline_at).diff(dayjs(), "minute")
          : null
        : appointment.completion_deadline_at
          ? dayjs(appointment.completion_deadline_at).diff(dayjs(), "minute")
          : null;
    return {
      title: `Заявка #${appointment.id}: работа уже идет`,
      helper: "Следите за лентой событий и держите чат открытым для быстрых уточнений.",
      ctaLabel: "Открыть чат и статус",
      to: buildAppointmentLink(appointment.id, "chat"),
      tone: "#0a567c",
      eta: targetMinutes != null ? `Ожидание: ${formatEtaMinutes(targetMinutes)}` : "",
      tips: WAITING_TIPS.progress,
    };
  }

  if ((appointment.unread_count || 0) > 0) {
    return {
      title: `Заявка #${appointment.id}: есть новые сообщения`,
      helper: "Ответьте мастеру, чтобы ускорить завершение заявки.",
      ctaLabel: "Перейти к диалогу",
      to: buildAppointmentLink(appointment.id, "chat"),
      tone: "#7b2cbf",
      eta: "",
      tips: WAITING_TIPS.review,
    };
  }

  return {
    title: `Заявка #${appointment.id}: продолжайте по шагам`,
    helper: "Все ключевые действия доступны на странице заявки в одном экране.",
    ctaLabel: "Открыть заявку",
    to: buildAppointmentLink(appointment.id, "timeline"),
    tone: "#0d6e9f",
    eta: "",
    tips: WAITING_TIPS.idle,
  };
}

export default function ClientHomePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [checklistState, setChecklistState] = useState(() => loadChecklistState());
  const [tipIndex, setTipIndex] = useState(0);

  const loadData = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const [summaryData, appointmentsResponse] = await Promise.all([
        authApi.dashboardSummary(),
        appointmentsApi.my(),
      ]);
      setSummary(summaryData.counts || {});
      setItems(appointmentsResponse.data || []);
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить дашборд клиента");
      }
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(() => loadData({ silent: true, withLoading: false }), { intervalMs: 7000 });

  useEffect(() => {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklistState));
  }, [checklistState]);

  const prioritizedAppointment = useMemo(() => pickPriorityAppointment(items), [items]);
  const scenario = useMemo(() => resolveScenario(prioritizedAppointment), [prioritizedAppointment]);
  const activeTip = scenario.tips?.[tipIndex] || "";

  useEffect(() => {
    setTipIndex(0);
  }, [scenario.title]);

  useEffect(() => {
    if (!scenario.tips || scenario.tips.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % scenario.tips.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [scenario.tips]);

  const checklistProgress = useMemo(() => {
    const done = CHECKLIST_ITEMS.filter((item) => checklistState[item.key]).length;
    return Math.round((done / CHECKLIST_ITEMS.length) * 100);
  }, [checklistState]);

  const visibleAppointments = useMemo(() => {
    const base = attentionOnly
      ? items.filter(
          (item) =>
            (item.unread_count || 0) > 0 ||
            item.status === "AWAITING_PAYMENT" ||
            item.status === "PAYMENT_PROOF_UPLOADED" ||
            item.status === "IN_PROGRESS" ||
            item.status === "IN_REVIEW"
        )
      : items;

    return [...base]
      .sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf())
      .slice(0, 4);
  }, [attentionOnly, items]);

  const toggleChecklist = (key) => {
    setChecklistState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #0d6e9f 0%, #2e8a66 48%, #1c9a4d 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            right: -30,
            top: -30,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <Stack spacing={1} sx={{ position: "relative" }}>
          <Typography variant="h5">Личный кабинет клиента</Typography>
          <Typography variant="body1" sx={{ opacity: 0.95, maxWidth: 760 }}>
            Вся работа по заявке в одном месте: прогресс, оплата, чат и история действий без лишних переходов.
          </Typography>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 2.25,
              borderRadius: 3,
              border: `1px solid ${scenario.tone}33`,
              background: `linear-gradient(140deg, ${scenario.tone}12 0%, #ffffff 45%)`,
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <BoltRoundedIcon sx={{ color: scenario.tone }} />
                <Typography variant="h6">Центр действий</Typography>
                <Chip size="small" label="Приоритет" sx={{ bgcolor: `${scenario.tone}22`, color: scenario.tone }} />
              </Stack>

              <Typography variant="h3">{scenario.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {scenario.helper}
              </Typography>
              {(scenario.eta || activeTip) && (
                <Stack spacing={1}>
                  {scenario.eta && (
                    <Chip
                      size="small"
                      label={scenario.eta}
                      sx={{
                        alignSelf: "flex-start",
                        bgcolor: `${scenario.tone}22`,
                        color: scenario.tone,
                        fontWeight: 700,
                      }}
                    />
                  )}
                  {activeTip && (
                    <Alert
                      severity="info"
                      icon={false}
                      sx={{
                        py: 0.5,
                        borderRadius: 2,
                        border: `1px solid ${scenario.tone}33`,
                        bgcolor: `${scenario.tone}10`,
                        color: scenario.tone,
                      }}
                    >
                      {activeTip}
                    </Alert>
                  )}
                </Stack>
              )}

              <Button
                component={RouterLink}
                to={scenario.to}
                variant="contained"
                size="large"
                sx={{ alignSelf: "flex-start", minWidth: 220 }}
              >
                {scenario.ctaLabel}
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.25, borderRadius: 3 }}>
            <Stack spacing={1.2}>
              <Typography variant="h6">Готовность к сессии</Typography>
              <Typography variant="body2" color="text.secondary">
                Отметьте пункты, чтобы снизить риск задержек и ускорить работу мастера.
              </Typography>
              <LinearProgress
                variant="determinate"
                value={checklistProgress}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  bgcolor: "#ecf2f8",
                  "& .MuiLinearProgress-bar": { borderRadius: 999 },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Готовность: {checklistProgress}%
              </Typography>

              <Stack spacing={0.25}>
                {CHECKLIST_ITEMS.map((item) => (
                  <FormControlLabel
                    key={item.key}
                    control={<Switch checked={Boolean(checklistState[item.key])} onChange={() => toggleChecklist(item.key)} />}
                    label={<Typography variant="body2">{item.label}</Typography>}
                  />
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Всего заявок" value={summary?.appointments_total ?? "-"} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Активные" value={summary?.appointments_active ?? "-"} accent="#2e8a66" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Ожидают оплату" value={summary?.awaiting_payment ?? "-"} accent="#c97a00" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Непрочитанные" value={summary?.unread_total ?? "-"} accent="#7b2cbf" />
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button component={RouterLink} to="/client/create" variant="contained" startIcon={<AddTaskIcon />}>
            Новая заявка
          </Button>
          <Button component={RouterLink} to="/client/my" variant="outlined" startIcon={<ListAltIcon />}>
            Все мои заявки
          </Button>
        </Stack>

        <FormControlLabel
          control={<Switch checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />}
          label="Только требующие внимания"
        />
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h6" mb={1}>Фокус-заявки</Typography>
        {loading && !visibleAppointments.length ? (
          <Stack spacing={1.25}>
            <AppointmentCardSkeleton />
            <AppointmentCardSkeleton />
          </Stack>
        ) : visibleAppointments.length ? (
          <Stack spacing={1.25}>
            {visibleAppointments.map((item) => (
              <AppointmentCard key={item.id} item={item} role="client" linkTo={`/appointments/${item.id}`} />
            ))}
          </Stack>
        ) : (
          <EmptyState
            title="Пока нет активных задач"
            description="Создайте первую заявку, и мастер сможет взять ее в работу."
            actionLabel="Создать заявку"
            onAction={() => navigate("/client/create")}
          />
        )}
      </Paper>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SecurityRoundedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Как проходит безопасная удаленная работа
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.8}>
            <Typography variant="body2">1. Мастер объясняет шаги перед подключением и согласовывает действия.</Typography>
            <Typography variant="body2">2. Вся коммуникация фиксируется в чате и ленте событий.</Typography>
            <Typography variant="body2">3. Оплата подтверждается чеком, статус обновляется автоматически.</Typography>
            <Typography variant="body2" color="text.secondary">Если что-то не получается, сразу пишите в чат заявки — это самый быстрый канал помощи.</Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
