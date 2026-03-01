import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { adminApi, appointmentsApi, reviewsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ChatPanel from "../components/ChatPanel";
import PrimaryCTA from "../components/ui/PrimaryCTA";
import StatusStepper from "../components/ui/StatusStepper";
import AppointmentDetailSkeleton from "../components/ui/skeletons/AppointmentDetailSkeleton";
import {
  APPOINTMENT_STATUS_OPTIONS,
  getLockTypeLabel,
  getPaymentMethodLabel,
  getStatusLabel,
} from "../constants/labels";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { resolveStatusUI } from "../theme/status";

dayjs.locale("ru");

const behaviorFlags = [
  { code: "bad_internet", label: "Проблемный интернет" },
  { code: "weak_pc", label: "Слабый ПК" },
  { code: "difficult_client", label: "Сложный клиент" },
  { code: "did_not_follow_instructions", label: "Не следовал инструкциям" },
  { code: "late_to_session", label: "Опоздал к подключению" },
  { code: "good_connection", label: "Отличная связь" },
  { code: "well_prepared", label: "Подготовлен заранее" },
];

const CLIENT_SIGNAL_OPTIONS = [
  {
    value: "ready_for_session",
    label: "Готов к подключению",
    helper: "Сообщить мастеру, что ПК и интернет уже готовы.",
  },
  {
    value: "need_help",
    label: "Нужна помощь по шагам",
    helper: "Если не получается пройти шаги самостоятельно.",
  },
  {
    value: "payment_issue",
    label: "Проблема с оплатой",
    helper: "Если оплата не проходит или есть вопрос по реквизитам.",
  },
  {
    value: "need_reschedule",
    label: "Нужно перенести сессию",
    helper: "Если подключение нужно на другое время.",
  },
];

const EVENT_LABELS = {
  status_changed: "Смена статуса",
  price_set: "Назначена цена",
  payment_proof_uploaded: "Загружен чек",
  payment_marked: "Клиент отметил оплату",
  payment_confirmed: "Оплата подтверждена",
  message_deleted: "Удалено сообщение",
  client_signal: "Сигнал клиента",
};

function getEventTitle(event) {
  if (event.event_type === "client_signal") {
    const signalLabel = CLIENT_SIGNAL_OPTIONS.find((option) => option.value === event.metadata?.signal)?.label;
    return signalLabel ? `${EVENT_LABELS.client_signal}: ${signalLabel}` : EVENT_LABELS.client_signal;
  }
  if (event.event_type === "status_changed") {
    if (event.from_status && event.to_status) {
      return `${EVENT_LABELS.status_changed}: ${getStatusLabel(event.from_status)} -> ${getStatusLabel(event.to_status)}`;
    }
    if (event.to_status) {
      return `${EVENT_LABELS.status_changed}: ${getStatusLabel(event.to_status)}`;
    }
    return EVENT_LABELS.status_changed;
  }
  return EVENT_LABELS[event.event_type] || event.event_type;
}

function buildFallbackEvents(appointment) {
  if (!appointment) {
    return [];
  }

  const actorId = appointment.assigned_master || null;
  const actorUsername = appointment.master_username || "";
  const events = [];

  const push = (eventType, createdAt, extra = {}) => {
    if (!createdAt) return;
    events.push({
      id: `fallback-${events.length + 1}`,
      event_type: eventType,
      from_status: "",
      to_status: "",
      note: "",
      metadata: {},
      actor: actorId,
      actor_username: actorUsername,
      created_at: createdAt,
      ...extra,
    });
  };

  push("status_changed", appointment.created_at, {
    to_status: "NEW",
    actor: appointment.client || null,
    actor_username: appointment.client_username || "Клиент",
    note: "Заявка создана",
  });
  push("status_changed", appointment.taken_at, {
    from_status: "NEW",
    to_status: "IN_REVIEW",
    note: "Заявка взята мастером",
  });
  push("price_set", appointment.updated_at, {
    note: appointment.total_price ? `total_price=${appointment.total_price}` : "",
    metadata: appointment.total_price ? { total_price: appointment.total_price } : {},
  });
  push("payment_marked", appointment.payment_marked_at);
  push("payment_confirmed", appointment.payment_confirmed_at);
  push("status_changed", appointment.started_at, { to_status: "IN_PROGRESS" });
  push("status_changed", appointment.completed_at, { to_status: "COMPLETED" });
  push("status_changed", appointment.updated_at, {
    to_status: appointment.status || "",
    note: "Текущее состояние заявки",
  });

  return events
    .filter((event) => {
      if (event.event_type === "price_set") {
        return Boolean(appointment.total_price);
      }
      return Boolean(event.created_at);
    })
    .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
}

function validatePaymentFile(file) {
  if (!file) {
    return "Выберите файл чека";
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "pdf"];
  if (!allowed.includes(ext)) {
    return "Формат файла: jpg, jpeg, png или pdf";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Размер файла не должен превышать 10 МБ";
  }
  return "";
}

function getLatestEventId(eventItems = []) {
  return eventItems.reduce(
    (maxId, event) => (typeof event.id === "number" && event.id > maxId ? event.id : maxId),
    0
  );
}

function formatEtaMinutes(minutes) {
  if (minutes == null) {
    return "—";
  }
  if (minutes <= 0) {
    return "срок наступил";
  }
  if (minutes < 60) {
    return `~${minutes} мин`;
  }
  const hours = Math.ceil(minutes / 60);
  return `~${hours} ч`;
}

export default function AppointmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, paymentSettings } = useAuth();

  const [appointment, setAppointment] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentFileError, setPaymentFileError] = useState("");

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [clientReviewFlags, setClientReviewFlags] = useState([]);

  const [manualStatus, setManualStatus] = useState("NEW");
  const [manualNote, setManualNote] = useState("");
  const [clientSignal, setClientSignal] = useState("need_help");
  const [clientSignalComment, setClientSignalComment] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => dayjs());
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentUploadedDialogOpen, setPaymentUploadedDialogOpen] = useState(false);
  const [paymentGuideOpen, setPaymentGuideOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const paymentRef = useRef(null);
  const chatRef = useRef(null);
  const reviewRef = useRef(null);
  const timelineRef = useRef(null);
  const lastEventIdRef = useRef(0);

  const mergeEvents = useCallback((incomingEvents = []) => {
    if (!incomingEvents.length) {
      return;
    }
    setEvents((prev) => {
      const dedup = new Map();
      [...prev, ...incomingEvents].forEach((event) => {
        dedup.set(String(event.id), event);
      });
      const merged = Array.from(dedup.values()).sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      );
      lastEventIdRef.current = getLatestEventId(merged);
      return merged;
    });
  }, []);

  const loadDetail = useCallback(async ({ preserveDrafts = false, silent = false } = {}) => {
    try {
      const appointmentResponse = await appointmentsApi.detail(id);
      setAppointment(appointmentResponse.data);
      if (!preserveDrafts) {
        setPrice(appointmentResponse.data.total_price || "");
        setManualStatus(appointmentResponse.data.status);
      }
      setLastSyncedAt(dayjs());
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить заявку");
      }
    }
  }, [id]);

  const loadEvents = useCallback(
    async ({ silent = false, incremental = false } = {}) => {
      try {
        const params = {};
        if (incremental && lastEventIdRef.current > 0) {
          params.after_id = lastEventIdRef.current;
        }
        const response = await appointmentsApi.events(id, params);
        const incoming = response.data || [];

        if (incremental) {
          mergeEvents(incoming);
          return;
        }

        const normalized = [...incoming].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
        setEvents(normalized);
        lastEventIdRef.current = getLatestEventId(normalized);
        setLastSyncedAt(dayjs());
      } catch {
        if (!silent) {
          setError("Не удалось загрузить ленту событий");
        }
      }
    },
    [id, mergeEvents]
  );

  const loadData = useCallback(
    async ({ preserveDrafts = false, silent = false } = {}) => {
      await Promise.all([
        loadDetail({ preserveDrafts, silent }),
        loadEvents({ silent, incremental: false }),
      ]);
    },
    [loadDetail, loadEvents]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) {
      return;
    }

    const byFocus = {
      payment: paymentRef,
      chat: chatRef,
      timeline: timelineRef,
      review: reviewRef,
    };

    const targetRef = byFocus[focus];
    if (!targetRef?.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [appointment?.id, searchParams]);

  useAutoRefresh(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadDetail({ preserveDrafts: true, silent: true }),
        loadEvents({ silent: true, incremental: true }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, {
    enabled: Boolean(id),
    intervalMs: 2500,
  });

  useEffect(() => {
    if (!appointment || user?.role !== "client") {
      setPaymentGuideOpen(false);
      return;
    }
    if (!["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)) {
      setPaymentGuideOpen(false);
      return;
    }
    const key = `frp_payment_guide_seen_${appointment.id}_${appointment.status}`;
    const seen = window.sessionStorage.getItem(key) === "1";
    if (!seen) {
      window.sessionStorage.setItem(key, "1");
      setPaymentGuideOpen(true);
    }
  }, [appointment, user?.role]);

  const timelineEvents = useMemo(
    () => (events.length ? events : buildFallbackEvents(appointment)),
    [events, appointment]
  );

  const mappedSystemEvents = useMemo(() => {
    const normalized = timelineEvents.map((event) => ({
      ...event,
      title: getEventTitle(event),
    }));
    if (user.role !== "client") {
      return normalized;
    }
    const allowedTypes = new Set([
      "status_changed",
      "price_set",
      "payment_proof_uploaded",
      "payment_confirmed",
    ]);
    return normalized.filter((event) => allowedTypes.has(event.event_type)).slice(-6);
  }, [timelineEvents, user.role]);

  const runAction = async (action) => {
    try {
      await action();
      await loadData({ preserveDrafts: true, silent: true });
      setSuccess("Действие выполнено");
      setError("");
      setToast({ open: true, severity: "success", message: "Действие выполнено" });
      return true;
    } catch (err) {
      const detailMessage = err.response?.data?.detail || "Ошибка выполнения действия";
      setSuccess("");
      setError(err.response?.data?.detail || "Ошибка выполнения действия");
      setToast({ open: true, severity: "error", message: detailMessage });
      return false;
    }
  };

  const sendClientSignal = async () => {
    const selectedSignal = CLIENT_SIGNAL_OPTIONS.find((option) => option.value === clientSignal);
    const ok = await runAction(async () => {
      await appointmentsApi.clientSignal(id, {
        signal: clientSignal,
        comment: clientSignalComment.trim(),
      });
    });
    if (ok) {
      setClientSignalComment("");
    }
    if (ok && selectedSignal) {
      setSuccess(`Сигнал отправлен: ${selectedSignal.label}`);
    }
  };

  const repeatAppointment = async () => {
    try {
      const response = await appointmentsApi.repeat(id);
      navigate(`/appointments/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Не удалось создать повторную заявку");
    }
  };

  const copyToClipboard = async (value) => {
    const text = (value || "").trim();
    if (!text) {
      setError("Реквизиты пока не заполнены администратором");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Скопировано в буфер обмена");
    } catch {
      setError("Не удалось скопировать автоматически. Скопируйте текст вручную.");
    }
  };

  if (!appointment) {
    return <AppointmentDetailSkeleton />;
  }

  const isClient = user.role === "client";
  const isMasterAssigned = user.role === "master" && appointment.assigned_master === user.id;

  const showClientPaymentActions =
    user.role === "client" &&
    ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status);
  const showClientReview = user.role === "client" && appointment.status === "COMPLETED";
  const showClientSignals = false;
  const showClientRepeat =
    user.role === "client" &&
    ["COMPLETED", "CANCELLED", "DECLINED_BY_MASTER"].includes(appointment.status);

  const showMasterTake = user.role === "master" && appointment.status === "NEW";
  const showMasterReviewAndPrice = isMasterAssigned && appointment.status === "IN_REVIEW";
  const showMasterConfirmPayment = isMasterAssigned && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showMasterStart = isMasterAssigned && appointment.status === "PAID";
  const showMasterComplete = isMasterAssigned && appointment.status === "IN_PROGRESS";
  const showMasterReviewClient = isMasterAssigned && appointment.status === "COMPLETED";

  const showAdminControls = user.role === "admin";
  const showAdminPaymentConfirm = showAdminControls && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showClientPaymentHighlight =
    user.role === "client" && ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status);
  const showClientPaymentDock = showClientPaymentHighlight;
  const showClientFloatingActionBar =
    user.role === "client" &&
    !showClientPaymentDock &&
    !["COMPLETED", "CANCELLED", "DECLINED_BY_MASTER"].includes(appointment.status);
  const paymentFlowStatusesDone = ["PAYMENT_PROOF_UPLOADED", "PAID", "IN_PROGRESS", "COMPLETED"];
  const paymentConfirmedStatuses = ["PAID", "IN_PROGRESS", "COMPLETED"];
  const latestPaymentProofEvent = timelineEvents.find((event) => event.event_type === "payment_proof_uploaded");
  const paymentReviewStartedAt = latestPaymentProofEvent?.created_at || appointment.payment_marked_at || appointment.updated_at;
  const paymentReviewMinutes = paymentReviewStartedAt ? dayjs().diff(dayjs(paymentReviewStartedAt), "minute") : null;
  const responseEtaMinutes = appointment.response_deadline_at
    ? dayjs(appointment.response_deadline_at).diff(dayjs(), "minute")
    : null;
  const completionEtaMinutes = appointment.completion_deadline_at
    ? dayjs(appointment.completion_deadline_at).diff(dayjs(), "minute")
    : null;
  const paymentProgressValue = (() => {
    if (appointment.status === "AWAITING_PAYMENT") return 34;
    if (appointment.status === "PAYMENT_PROOF_UPLOADED") return 67;
    if (paymentConfirmedStatuses.includes(appointment.status)) return 100;
    return 0;
  })();
  const lastSyncLabel = dayjs(lastSyncedAt).format("HH:mm:ss");
  const visibleTimelineEvents = isClient ? timelineEvents.slice(0, 8) : timelineEvents;

  const statusUi = resolveStatusUI(appointment.status, appointment.sla_breached);

  const handlePrimaryAction = async (actionKey) => {
    if (actionKey === "open_payment") {
      paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_chat") {
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_timeline") {
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "leave_review") {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "create_new") {
      navigate("/client/create");
      return;
    }

    if (actionKey === "take") {
      await runAction(() => appointmentsApi.take(id));
      return;
    }
    if (actionKey === "set_price") {
      if (!Number(price) || Number(price) <= 0) {
        setError("Укажите цену в рублях");
        return;
      }
      await runAction(() => appointmentsApi.setPrice(id, Number(price)));
      return;
    }
    if (actionKey === "confirm_payment") {
      await runAction(() => appointmentsApi.confirmPayment(id));
      return;
    }
    if (actionKey === "start_work") {
      await runAction(() => appointmentsApi.start(id));
      return;
    }
    if (actionKey === "complete_work") {
      await runAction(() => appointmentsApi.complete(id));
      return;
    }
    if (actionKey === "confirm_payment_admin") {
      await runAction(() => adminApi.confirmPayment(id));
    }
  };

  const uploadPaymentProof = async () => {
    const validationError = validatePaymentFile(paymentProofFile);
    setPaymentFileError(validationError);
    if (validationError) {
      return;
    }

    const formData = new FormData();
    formData.append("payment_proof", paymentProofFile);
    setUploadingProof(true);
    try {
      const ok = await runAction(async () => {
        await appointmentsApi.uploadPaymentProof(id, formData);
      });
      if (ok) {
        setToast({ open: true, severity: "success", message: "Чек загружен. Проверяем оплату" });
        setPaymentUploadedDialogOpen(true);
      }
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.2 }}>
        <Stack spacing={1.4}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.1}>
            <Box>
              <Typography variant="h2">Заявка #{appointment.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {appointment.brand} {appointment.model} • {getLockTypeLabel(appointment.lock_type)}
              </Typography>
            </Box>
            <Chip
              label={statusUi.label}
              sx={{ bgcolor: statusUi.bg, color: statusUi.color, border: `1px solid ${statusUi.color}33`, fontWeight: 700 }}
            />
          </Stack>

          <StatusStepper status={appointment.status} role={user.role} slaBreached={appointment.sla_breached} />

          <PrimaryCTA status={appointment.status} role={user.role} onAction={handlePrimaryAction} />

          {isRefreshing ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="caption" color="text.secondary">
              {isRefreshing ? "Обновляем статус и чат..." : `Последнее обновление: ${lastSyncLabel}`}
            </Typography>
            {user.role !== "client" ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_payment")}>
                  К оплате
                </Button>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_chat")}>
                  К чату
                </Button>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
                  К ленте
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}
      {showClientPaymentHighlight ? (
        <Alert
          severity={appointment.status === "AWAITING_PAYMENT" ? "warning" : "info"}
          action={
            <Button color="inherit" size="small" onClick={() => handlePrimaryAction("open_payment")}>
              Перейти
            </Button>
          }
        >
          {appointment.status === "AWAITING_PAYMENT"
            ? "Сейчас главный шаг: оплата и загрузка чека. После этого мастер сразу продолжит работу."
            : "Чек загружен и уже на проверке. Обычно это занимает 1-5 минут."}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2.2 }}>
              <Typography variant="h3" sx={{ mb: 1 }}>Данные заявки</Typography>
              <Stack spacing={0.7}>
                <Typography variant="body2"><b>Устройство:</b> {appointment.brand} {appointment.model}</Typography>
                <Typography variant="body2"><b>Тип блокировки:</b> {getLockTypeLabel(appointment.lock_type)}</Typography>
                <Typography variant="body2"><b>Цена:</b> {appointment.total_price ? `${appointment.total_price} руб.` : "Не выставлена"}</Typography>
                <Typography variant="body2"><b>Мастер:</b> {appointment.master_username || appointment.assigned_master || "Пока не назначен"}</Typography>
                {appointment.description ? (
                  <Typography variant="body2"><b>Комментарий:</b> {appointment.description}</Typography>
                ) : null}
                {!isClient ? (
                  <>
                    <Typography variant="body2"><b>Есть ПК:</b> {appointment.has_pc ? "Да" : "Нет"}</Typography>
                    <Typography variant="body2"><b>Клиент:</b> {appointment.client_username || appointment.client}</Typography>
                  </>
                ) : null}
                {appointment.photo_lock_screen_url ? (
                  <Typography variant="body2">
                    <a href={appointment.photo_lock_screen_url} target="_blank" rel="noreferrer">Фото экрана блокировки</a>
                  </Typography>
                ) : null}
                {appointment.payment_proof_url ? (
                  <Typography variant="body2">
                    <a href={appointment.payment_proof_url} target="_blank" rel="noreferrer">Чек/скрин оплаты</a>
                  </Typography>
                ) : null}
              </Stack>
            </Paper>

            {showMasterReviewAndPrice ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Панель действий мастера</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Цена (руб.)"
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    helperText="Обычно занимает 1-2 минуты"
                  />
                  <Button variant="outlined" onClick={() => handlePrimaryAction("set_price")}>Сохранить цену</Button>
                  <Button color="warning" variant="outlined" onClick={() => runAction(() => appointmentsApi.decline(id))}>
                    Отклонить
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showMasterConfirmPayment ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Оплата клиента</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Проверьте чек и подтвердите оплату. Если не получается — напишите клиенту в чат.
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("confirm_payment")}>Подтвердить оплату</Button>
              </Paper>
            ) : null}

            {showMasterStart ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Запуск работы</Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("start_work")}>Начать работу</Button>
              </Paper>
            ) : null}

            {showMasterComplete ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Завершение</Typography>
                <Button variant="outlined" color="success" onClick={() => handlePrimaryAction("complete_work")}>Завершить работу</Button>
              </Paper>
            ) : null}

            {showMasterTake ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Новая заявка</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Что делать дальше: возьмите заявку, чтобы закрепить ее за собой.
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("take")}>Взять заявку</Button>
              </Paper>
            ) : null}

            {showClientPaymentActions ? (
              <Paper
                ref={paymentRef}
                sx={{
                  p: 2.2,
                  border: "1px solid",
                  borderColor: "warning.light",
                  boxShadow: (theme) => `0 0 0 3px ${theme.palette.warning.light}22`,
                }}
              >
                <Typography variant="h3" sx={{ mb: 0.7 }}>
                  {appointment.status === "AWAITING_PAYMENT" ? "Оплата и чек" : "Чек отправлен на проверку"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {appointment.status === "AWAITING_PAYMENT"
                    ? "Что делать дальше: 1) оплатите 2) загрузите чек 3) нажмите «Я оплатил»."
                    : "Проверяем чек. Обычно это занимает 1-5 минут. Если задержка — откройте чат и напишите мастеру."}
                </Typography>

                {appointment.status === "PAYMENT_PROOF_UPLOADED" && paymentReviewMinutes != null ? (
                  <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ mb: 1 }}>
                    {paymentReviewMinutes < 1
                      ? "Проверка чека началась только что."
                      : `Проверка чека идет ${paymentReviewMinutes} мин.`}
                  </Alert>
                ) : null}

                <Stack spacing={0.4} sx={{ mb: 1 }}>
                  <Typography variant="body2"><b>Банк:</b> {paymentSettings?.bank_requisites || "не указано"}</Typography>
                  <Typography variant="body2"><b>Криптовалюта:</b> {paymentSettings?.crypto_requisites || "не указано"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {paymentSettings?.instructions || "Если не получается — напишите в чат."}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                      onClick={() => copyToClipboard(paymentSettings?.bank_requisites)}
                    >
                      Скопировать реквизиты банка
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                      onClick={() => copyToClipboard(paymentSettings?.crypto_requisites)}
                    >
                      Скопировать реквизиты крипто
                    </Button>
                  </Stack>
                </Stack>

                <Stack spacing={1}>
                  <Button component="label" variant="outlined">
                    {appointment.status === "AWAITING_PAYMENT" ? "Выбрать файл чека" : "Загрузить новый чек"}
                    <input
                      hidden
                      type="file"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] || null;
                        setPaymentProofFile(selected);
                        setPaymentFileError(selected ? validatePaymentFile(selected) : "");
                      }}
                    />
                  </Button>
                  <Typography variant="body2">{paymentProofFile ? paymentProofFile.name : "Файл не выбран"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Форматы: jpg, jpeg, png, pdf. Максимум 10 МБ.
                  </Typography>
                  {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

                  <Button variant="contained" onClick={uploadPaymentProof} disabled={uploadingProof || !paymentProofFile}>
                    {uploadingProof ? "Загружаем чек..." : appointment.status === "AWAITING_PAYMENT" ? "Загрузить чек" : "Отправить новый чек"}
                  </Button>

                  <TextField select label="Способ оплаты" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
                    <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
                  </TextField>

                  {appointment.status === "AWAITING_PAYMENT" ? (
                    <Button variant="outlined" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
                      Я оплатил
                    </Button>
                  ) : (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="outlined" onClick={() => handlePrimaryAction("open_chat")}>
                        Открыть чат
                      </Button>
                      <Button variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
                        Открыть ленту
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ) : null}

            {showClientSignals ? (
              <Paper sx={{ p: 2.2 }}>
                <Stack spacing={1.1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CampaignRoundedIcon color="primary" fontSize="small" />
                    <Typography variant="h3">Быстрый сигнал мастеру</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Один клик, чтобы мастер понял ваш текущий контекст. Это ускоряет ответ и снижает паузы.
                  </Typography>

                  <TextField
                    select
                    label="Что сейчас важно"
                    value={clientSignal}
                    onChange={(event) => setClientSignal(event.target.value)}
                    helperText={CLIENT_SIGNAL_OPTIONS.find((option) => option.value === clientSignal)?.helper || ""}
                  >
                    {CLIENT_SIGNAL_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    label="Комментарий (опционально)"
                    placeholder="Например: код ошибки, удобное время, что уже попробовали"
                    multiline
                    minRows={2}
                    value={clientSignalComment}
                    onChange={(event) => setClientSignalComment(event.target.value)}
                  />

                  <Button variant="outlined" onClick={sendClientSignal}>
                    Отправить сигнал
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showClientRepeat ? (
              <Paper sx={{ p: 2.2 }}>
                <Stack spacing={1}>
                  <Typography variant="h3">Нужна похожая заявка?</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создадим новую заявку с теми же параметрами устройства. Останется только уточнить детали.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<ReplayRoundedIcon />}
                    onClick={repeatAppointment}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Повторить заявку
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showAdminControls ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Управление заявкой (админ)</Typography>
                <Stack spacing={1}>
                  {showAdminPaymentConfirm ? (
                    <Button variant="outlined" onClick={() => handlePrimaryAction("confirm_payment_admin")}>
                      Подтвердить оплату
                    </Button>
                  ) : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField select label="Сменить статус" value={manualStatus} onChange={(event) => setManualStatus(event.target.value)}>
                      {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>
                      ))}
                    </TextField>
                    <TextField label="Комментарий" value={manualNote} onChange={(event) => setManualNote(event.target.value)} />
                    <Button variant="outlined" onClick={() => runAction(() => adminApi.setStatus(id, { status: manualStatus, note: manualNote }))}>
                      Применить
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ) : null}

            {showClientReview ? (
              <Paper ref={reviewRef} sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Оцените работу мастера</Typography>
                <Stack spacing={1}>
                  <TextField type="number" label="Рейтинг 1-5" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} />
                  <TextField label="Комментарий" multiline minRows={2} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
                  <Button variant="outlined" onClick={() => runAction(() => reviewsApi.reviewMaster(id, { rating: reviewRating, comment: reviewComment }))}>
                    Отправить отзыв
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showMasterReviewClient ? (
              <Paper ref={reviewRef} sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Оценка клиента</Typography>
                <Stack spacing={1}>
                  <TextField type="number" label="Рейтинг 1-5" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} />
                  <TextField
                    select
                    label="Флаги поведения"
                    SelectProps={{ multiple: true }}
                    value={clientReviewFlags}
                    onChange={(event) =>
                      setClientReviewFlags(
                        typeof event.target.value === "string"
                          ? event.target.value.split(",")
                          : event.target.value
                      )
                    }
                  >
                    {behaviorFlags.map((flag) => (
                      <MenuItem key={flag.code} value={flag.code}>{flag.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Комментарий" multiline minRows={2} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
                  <Button
                    variant="outlined"
                    onClick={() =>
                      runAction(() =>
                        reviewsApi.reviewClient(id, {
                          rating: reviewRating,
                          behavior_flags: clientReviewFlags,
                          comment: reviewComment,
                        })
                      )
                    }
                  >
                    Сохранить оценку клиента
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            <Box ref={chatRef}>
              <ChatPanel appointmentId={id} currentUser={user} systemEvents={mappedSystemEvents} />
            </Box>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2.2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ShieldRoundedIcon color="primary" fontSize="small" />
                <Typography variant="h3">Доверие и прозрачность</Typography>
              </Stack>

              <Stack spacing={0.7}>
                <Typography variant="body2"><b>Мастер:</b> {appointment.master_username || "Пока не назначен"}</Typography>
                {user.role !== "client" ? (
                  <Typography variant="body2"><b>Риск клиента:</b> {appointment.client_risk_level || "—"} {appointment.client_risk_score != null ? `(${appointment.client_risk_score})` : ""}</Typography>
                ) : null}
                <Typography variant="body2"><b>SLA ответ до:</b> {appointment.response_deadline_at ? dayjs(appointment.response_deadline_at).format("DD.MM.YYYY HH:mm") : "—"}</Typography>
                <Typography variant="body2"><b>SLA завершение до:</b> {appointment.completion_deadline_at ? dayjs(appointment.completion_deadline_at).format("DD.MM.YYYY HH:mm") : "—"}</Typography>
                {["NEW", "IN_REVIEW"].includes(appointment.status) && responseEtaMinutes != null ? (
                  <Alert severity={responseEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
                    Ожидаем ответ мастера: {formatEtaMinutes(responseEtaMinutes)}
                  </Alert>
                ) : null}
                {["PAID", "IN_PROGRESS"].includes(appointment.status) && completionEtaMinutes != null ? (
                  <Alert severity={completionEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
                    Прогноз до завершения: {formatEtaMinutes(completionEtaMinutes)}
                  </Alert>
                ) : null}
                {appointment.sla_breached ? (
                  <Alert severity="warning">SLA нарушен. Мы уже уведомили администратора.</Alert>
                ) : null}

                {!isClient ? (
                  <>
                    <Divider sx={{ my: 0.7 }} />
                    <Typography variant="caption">Что делать дальше: ориентируйтесь на шаги сверху и используйте чат для всех уточнений.</Typography>
                    <Typography variant="caption">Обычно назначение мастера занимает 5-15 минут.</Typography>
                    <Typography variant="caption">Если не получается — напишите в чат, мы подключимся.</Typography>
                  </>
                ) : null}
              </Stack>
            </Paper>

            <Paper ref={timelineRef} sx={{ p: 2.2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <TimelineRoundedIcon color="primary" fontSize="small" />
                <Typography variant="h3">Лента событий</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Обновляется автоматически каждые 3-4 секунды
              </Typography>

              {visibleTimelineEvents.length ? (
                <Stack spacing={1}>
                  {visibleTimelineEvents.map((event, index) => (
                    <Stack key={event.id} spacing={0.35}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{getEventTitle(event)}</Typography>
                      {event.note ? <Typography variant="caption" color="text.secondary">{event.note}</Typography> : null}
                      <Typography variant="caption" color="text.secondary">
                        {event.actor_username || "Система"} • {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                      </Typography>
                      {index < visibleTimelineEvents.length - 1 ? <Divider /> : null}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">События пока отсутствуют.</Typography>
              )}
              {isClient && timelineEvents.length > visibleTimelineEvents.length ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Показаны последние события. Полная история доступна администратору.
                </Typography>
              ) : null}
            </Paper>
          </Stack>
        </Grid>
      </Grid>
      {showClientFloatingActionBar ? (
        <Paper
          elevation={6}
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            left: 8,
            right: 8,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)",
            zIndex: 1285,
            p: 0.8,
            borderRadius: 2.5,
            border: "1px solid #dce6f0",
          }}
        >
          <Stack direction="row" spacing={0.6}>
            <Button
              fullWidth
              size="small"
              variant={["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "contained" : "text"}
              onClick={() =>
                handlePrimaryAction(
                  ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)
                    ? "open_payment"
                    : "open_chat"
                )
              }
            >
              {["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "Оплата" : "Помощь"}
            </Button>
            <Button fullWidth size="small" variant="text" onClick={() => handlePrimaryAction("open_chat")}>
              Чат
            </Button>
            <Button fullWidth size="small" variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
              Статус
            </Button>
          </Stack>
        </Paper>
      ) : null}
      {showClientPaymentDock ? (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            left: { xs: 8, md: "auto" },
            right: { xs: 8, md: 24 },
            bottom: { xs: "calc(env(safe-area-inset-bottom, 0px) + 86px)", md: 24 },
            zIndex: 1290,
            width: { xs: "auto", md: 420 },
            p: 1.2,
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "warning.light",
            boxShadow: (theme) => `0 18px 42px ${theme.palette.warning.light}55`,
            bgcolor: "#fffdfa",
          }}
        >
          <Stack spacing={0.8}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {appointment.status === "AWAITING_PAYMENT" ? "Оплата ожидает вашего действия" : "Чек отправлен на проверку"}
            </Typography>
            <LinearProgress variant="determinate" value={paymentProgressValue} sx={{ borderRadius: 999, height: 8 }} />
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="1) Оплата"
                color={appointment.status === "AWAITING_PAYMENT" ? "warning" : "success"}
                variant={appointment.status === "AWAITING_PAYMENT" ? "filled" : "outlined"}
              />
              <Chip
                size="small"
                label="2) Чек"
                color={paymentFlowStatusesDone.includes(appointment.status) ? "success" : "default"}
                variant={paymentFlowStatusesDone.includes(appointment.status) ? "outlined" : "filled"}
              />
              <Chip
                size="small"
                label="3) Подтверждение"
                color={
                  paymentConfirmedStatuses.includes(appointment.status)
                    ? "success"
                    : appointment.status === "PAYMENT_PROOF_UPLOADED"
                      ? "warning"
                      : "default"
                }
                variant={paymentConfirmedStatuses.includes(appointment.status) ? "outlined" : "filled"}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {appointment.status === "AWAITING_PAYMENT"
                ? "Сначала оплатите, загрузите чек и нажмите «Я оплатил». Обычно это занимает 1-2 минуты."
                : "Пока идет проверка, держите открытым чат. Если ответа нет 5 минут — напишите мастеру."}
            </Typography>
            {appointment.status === "PAYMENT_PROOF_UPLOADED" && paymentReviewMinutes != null ? (
              <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ py: 0 }}>
                {paymentReviewMinutes < 1
                  ? "Проверка чека началась только что."
                  : `Проверка чека идет ${paymentReviewMinutes} мин.`}
                {paymentReviewMinutes >= 10 ? " Если затянулось — откройте чат и напишите мастеру." : ""}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={() =>
                  handlePrimaryAction(appointment.status === "AWAITING_PAYMENT" ? "open_payment" : "open_chat")
                }
              >
                {appointment.status === "AWAITING_PAYMENT" ? "Перейти к оплате" : "Открыть чат"}
              </Button>
              <Button fullWidth variant="outlined" onClick={() => handlePrimaryAction("open_timeline")}>
                Лента
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
      <Dialog
        open={paymentGuideOpen}
        onClose={() => setPaymentGuideOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {appointment.status === "AWAITING_PAYMENT"
            ? "Следующий шаг: оплата и чек"
            : "Чек отправлен, ожидаем подтверждение"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography variant="body2">
              {appointment.status === "AWAITING_PAYMENT"
                ? "Оплатите по реквизитам, загрузите файл чека и нажмите «Я оплатил». Это обычно занимает 1-2 минуты."
                : "Чек уже у мастера. Обычно проверка занимает 1-5 минут. Держите чат открытым на случай уточнений."}
            </Typography>
            {appointment.status === "PAYMENT_PROOF_UPLOADED" && paymentReviewMinutes != null ? (
              <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ py: 0 }}>
                {paymentReviewMinutes < 1
                  ? "Проверка началась только что."
                  : `Проверка идет ${paymentReviewMinutes} мин.`}
              </Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Если что-то не получается, нажмите «Открыть чат» и напишите мастеру одним сообщением.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentGuideOpen(false)}>Позже</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPaymentGuideOpen(false);
              handlePrimaryAction(appointment.status === "AWAITING_PAYMENT" ? "open_payment" : "open_chat");
            }}
          >
            {appointment.status === "AWAITING_PAYMENT" ? "Перейти к оплате" : "Открыть чат"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={paymentUploadedDialogOpen}
        onClose={() => setPaymentUploadedDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Чек загружен</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="body2">
              Мы уже отправили чек на проверку. Обычно подтверждение занимает 1-5 минут.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Если ответа нет дольше 10 минут, откройте чат и напишите мастеру.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentUploadedDialogOpen(false)}>Понятно</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPaymentUploadedDialogOpen(false);
              handlePrimaryAction("open_chat");
            }}
          >
            Открыть чат
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={toast.open}
        autoHideDuration={2600}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
