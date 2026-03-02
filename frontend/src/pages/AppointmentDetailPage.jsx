import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fade,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
import { normalizeRuText } from "../utils/text";

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
    return signalLabel
      ? normalizeRuText(`${EVENT_LABELS.client_signal}: ${signalLabel}`)
      : EVENT_LABELS.client_signal;
  }
  if (event.event_type === "status_changed") {
    if (event.from_status && event.to_status) {
      return normalizeRuText(
        `${EVENT_LABELS.status_changed}: ${getStatusLabel(event.from_status)} -> ${getStatusLabel(event.to_status)}`
      );
    }
    if (event.to_status) {
      return normalizeRuText(`${EVENT_LABELS.status_changed}: ${getStatusLabel(event.to_status)}`);
    }
    return EVENT_LABELS.status_changed;
  }
  return normalizeRuText(EVENT_LABELS[event.event_type] || event.event_type);
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

function normalizeEventTimestamp(value) {
  if (!value) return "";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);
  return parsed.format("YYYY-MM-DDTHH:mm:ss");
}

function getEventFingerprint(event) {
  return [
    event.event_type || "",
    event.from_status || "",
    event.to_status || "",
    event.actor || "",
    normalizeEventTimestamp(event.created_at),
    (event.note || "").trim(),
    String(event.metadata?.total_price ?? ""),
  ].join("|");
}

function dedupeEvents(eventItems = []) {
  const seen = new Set();
  return eventItems.filter((event) => {
    const key = getEventFingerprint(event);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function resolveClientActionByStatus(status) {
  if (["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(status)) {
    return "open_payment";
  }
  if (status === "COMPLETED") {
    return "leave_review";
  }
  return "open_chat";
}

export default function AppointmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, paymentSettings } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

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
  const [paymentFocusOpen, setPaymentFocusOpen] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [clientTab, setClientTab] = useState("chat");
  const [toast, setToast] = useState({ open: false, severity: "success", message: "", actionKey: "" });
  const [clientCompactView, setClientCompactView] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const saved = window.localStorage.getItem("frp_client_compact_view");
    if (saved === "1") return true;
    if (saved === "0") return false;
    return true;
  });

  const paymentRef = useRef(null);
  const chatRef = useRef(null);
  const reviewRef = useRef(null);
  const timelineRef = useRef(null);
  const paymentFileInputRef = useRef(null);
  const lastEventIdRef = useRef(0);
  const lastKnownStatusRef = useRef(null);

  const mergeEvents = useCallback((incomingEvents = []) => {
    if (!incomingEvents.length) {
      return;
    }
    setEvents((prev) => {
      const merged = dedupeEvents([...prev, ...incomingEvents]).sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      );
      lastEventIdRef.current = getLatestEventId(merged);
      return merged;
    });
  }, []);

  const loadDetail = useCallback(async ({ preserveDrafts = false, silent = false } = {}) => {
    try {
      const appointmentResponse = await appointmentsApi.detail(id);
      const nextStatus = appointmentResponse.data?.status || null;
      const previousStatus = lastKnownStatusRef.current;
      if (previousStatus && nextStatus && previousStatus !== nextStatus) {
        setToast({
          open: true,
          severity: "info",
          message: `Статус обновился: ${getStatusLabel(nextStatus)}`,
          actionKey: resolveClientActionByStatus(nextStatus),
        });
      }
      lastKnownStatusRef.current = nextStatus;
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

        const normalized = dedupeEvents(incoming).sort(
          (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
        );
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

    if (user?.role === "client") {
      if (focus === "payment" && ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment?.status)) {
        setClientTab("payment");
      } else if (focus === "timeline" || focus === "review") {
        setClientTab(clientCompactView ? "chat" : "details");
      } else if (focus === "chat") {
        setClientTab("chat");
      }
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
  }, [appointment?.id, appointment?.status, clientCompactView, searchParams, user?.role]);

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

  useEffect(() => {
    if (!appointment || user?.role !== "client" || !isMobile) {
      setPaymentFocusOpen(false);
      return;
    }
    if (!["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)) {
      setPaymentFocusOpen(false);
      return;
    }
    const key = `frp_payment_focus_seen_${appointment.id}_${appointment.status}`;
    const seen = window.sessionStorage.getItem(key) === "1";
    if (!seen) {
      window.sessionStorage.setItem(key, "1");
      setPaymentFocusOpen(true);
    }
  }, [appointment, user?.role, isMobile]);

  useEffect(() => {
    if (!appointment || user?.role !== "client") {
      return;
    }
    if (["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)) {
      setClientTab("payment");
      return;
    }
    setClientTab((prev) => {
      if (prev === "payment") return "chat";
      if (clientCompactView && prev === "details") return "chat";
      return prev;
    });
  }, [appointment?.id, appointment?.status, clientCompactView, user?.role]);

  useEffect(() => {
    if (user?.role !== "client") {
      return;
    }
    window.localStorage.setItem("frp_client_compact_view", clientCompactView ? "1" : "0");
  }, [clientCompactView, user?.role]);

  useEffect(() => {
    if (user?.role !== "client" || !clientCompactView) {
      return;
    }
    setClientTab((prev) => {
      if (prev !== "details") {
        return prev;
      }
      return ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment?.status) ? "payment" : "chat";
    });
  }, [appointment?.status, clientCompactView, user?.role]);

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

  const copyToClipboard = async (value, emptyMessage = "Нет данных для копирования") => {
    const text = (value || "").trim();
    if (!text) {
      setError(emptyMessage);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Скопировано в буфер обмена");
    } catch {
      setError("Не удалось скопировать автоматически. Скопируйте текст вручную.");
    }
  };

  const openRuDesktopSession = async (remoteId, remotePassword = "") => {
    const preparedId = String(remoteId || "").trim();
    if (!preparedId) {
      setError("RuDesktop ID не указан");
      return;
    }

    const payload = remotePassword
      ? `RuDesktop ID: ${preparedId}\nПароль: ${remotePassword}`
      : `RuDesktop ID: ${preparedId}`;

    try {
      await navigator.clipboard.writeText(payload);
      setSuccess("Данные подключения скопированы. Открываем RuDesktop...");
    } catch {
      setSuccess("Открываем RuDesktop. Если нужно — скопируйте ID вручную.");
    }

    window.location.href = "rustdesk://";
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
  const showClientTabs = user.role === "client";

  const showMasterTake = user.role === "master" && appointment.status === "NEW";
  const showMasterReviewAndPrice = isMasterAssigned && appointment.status === "IN_REVIEW";
  const showMasterConfirmPayment = isMasterAssigned && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showMasterStart = isMasterAssigned && appointment.status === "PAID";
  const showMasterComplete = isMasterAssigned && appointment.status === "IN_PROGRESS";
  const showMasterReviewClient = isMasterAssigned && appointment.status === "COMPLETED";

  const showAdminControls = user.role === "admin";
  const showAdminPaymentConfirm = showAdminControls && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showClientPaymentHighlight = isClient && ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status);
  const isClientCompact = isClient && clientCompactView;
  const clientDetailsTabEnabled = !isClientCompact;
  const showClientDesktopSidebar = isClient && !isMobile;
  const showClientPaymentDock =
    showClientDesktopSidebar &&
    ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status);
  const showClientFloatingActionBar = isClient && isMobile && !paymentFocusOpen && !showClientTabs;
  const showClientQuickRail = isClient && isMobile && !isClientCompact;
  const clientPaymentTabDisabled = !showClientPaymentActions;
  const showClientDataCard = !showClientTabs || (clientTab === "details" && clientDetailsTabEnabled);
  const showClientPaymentCard = showClientPaymentActions && (!showClientTabs || clientTab === "payment");
  const showClientChatPanel = !showClientTabs || clientTab === "chat";
  const showClientDetailsCard = showClientTabs && clientTab === "details" && clientDetailsTabEnabled;
  const showClientSecondaryCards =
    !showClientTabs || clientTab === "details" || (isClientCompact && clientTab === "chat");
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
  const paymentFlowActiveStep = (() => {
    if (appointment.status === "AWAITING_PAYMENT") return 0;
    if (appointment.status === "PAYMENT_PROOF_UPLOADED") return 1;
    if (paymentConfirmedStatuses.includes(appointment.status)) return 2;
    return 0;
  })();
  const isAwaitingPayment = appointment.status === "AWAITING_PAYMENT";
  const isPaymentProofUploaded = appointment.status === "PAYMENT_PROOF_UPLOADED";
  const paymentFlowLabels = ["Оплата", "Чек", "Подтверждение"];
  const canUploadPaymentProof = Boolean(paymentProofFile) && !paymentFileError && !uploadingProof;
  const paymentProofMeta = paymentProofFile
    ? `${paymentProofFile.name} • ${(paymentProofFile.size / (1024 * 1024)).toFixed(2)} МБ`
    : "Файл не выбран";
  const paymentDropZoneSx = {
    p: 1.1,
    borderRadius: 2,
    border: "1px dashed",
    borderColor: paymentDragOver ? "primary.main" : "divider",
    bgcolor: paymentDragOver
      ? isDark
        ? "rgba(90,169,255,0.18)"
        : "rgba(2,132,199,0.06)"
      : isDark
        ? "rgba(15,23,42,0.6)"
        : "rgba(255,255,255,0.72)",
    transition: "all .2s ease",
    cursor: "pointer",
  };
  const lastSyncLabel = dayjs(lastSyncedAt).format("HH:mm:ss");
  const visibleTimelineEvents = isClient ? timelineEvents.slice(0, isClientCompact ? 3 : 6) : timelineEvents;
  const sidebarTimelineEvents = isClient ? visibleTimelineEvents.slice(0, isClientCompact ? 2 : 4) : visibleTimelineEvents;
  const rustdeskId = (appointment.rustdesk_id || "").trim();
  const rustdeskPassword = (appointment.rustdesk_password || "").trim();
  const ruDesktopConnectAllowedStatuses = ["PAID", "IN_PROGRESS"];
  const hasRuDesktopCredentials = Boolean(rustdeskId) && ["master", "admin"].includes(user.role);
  const canLaunchRuDesktop = hasRuDesktopCredentials && ruDesktopConnectAllowedStatuses.includes(appointment.status);
  const sidebarLinks = [
    {
      id: "rustdesk_download",
      label: "Скачать RuDesktop",
      href: "https://rustdesk.com/download",
    },
    {
      id: "rustdesk_guide",
      label: "Инструкция по RuDesktop",
      href: "https://rustdesk.com/docs/en/",
    },
    ...(appointment.photo_lock_screen_url
      ? [
          {
            id: "lock_screen",
            label: "Фото экрана блокировки",
            href: appointment.photo_lock_screen_url,
          },
        ]
      : []),
    ...(appointment.payment_proof_url
      ? [
          {
            id: "payment_proof",
            label: "Чек/скрин оплаты",
            href: appointment.payment_proof_url,
          },
        ]
      : []),
  ];
  const actionEtaLabel = (() => {
    if (appointment.status === "AWAITING_PAYMENT") {
      return "После оплаты мастер продолжит обычно за 1-5 минут";
    }
    if (["NEW", "IN_REVIEW"].includes(appointment.status) && responseEtaMinutes != null) {
      return `Ожидаем ответ: ${formatEtaMinutes(responseEtaMinutes)}`;
    }
    if (["PAID", "IN_PROGRESS"].includes(appointment.status) && completionEtaMinutes != null) {
      return `До завершения: ${formatEtaMinutes(completionEtaMinutes)}`;
    }
    return "";
  })();
  const clientQuickActions = isClient
    ? [
        {
          id: "focus",
          key: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "open_payment" : "open_chat",
          label: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "Оплата" : "Чат",
          tab: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "payment" : "chat",
          icon:
            ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? (
              <PaymentsRoundedIcon fontSize="small" />
            ) : (
              <ForumRoundedIcon fontSize="small" />
            ),
          emphasis: true,
        },
        {
          id: "messages",
          key: "open_chat",
          label: "Сообщения",
          tab: "chat",
          icon: <ForumRoundedIcon fontSize="small" />,
        },
        {
          id: "status",
          key: "open_timeline",
          label: "Статус",
          tab: "details",
          icon: <TimelineRoundedIcon fontSize="small" />,
        },
        ...(appointment.status === "COMPLETED"
          ? [
              {
                id: "review",
                key: "leave_review",
                label: "Отзыв",
                tab: "details",
                icon: <InfoOutlinedIcon fontSize="small" />,
              },
            ]
          : []),
      ]
    : [];
  const clientSidebarActions = (isClientCompact
    ? clientQuickActions.filter((action) => action.id !== "status")
    : clientQuickActions
  ).slice(0, 3);
  const clientRailActions = isClientCompact
    ? clientQuickActions.filter((action) => action.id !== "status")
    : clientQuickActions;

  const statusUi = resolveStatusUI(appointment.status, appointment.sla_breached);
  const clientFocus = (() => {
    if (!isClient) {
      return null;
    }
    if (appointment.status === "AWAITING_PAYMENT") {
      return {
        title: "Оплатите и прикрепите чек",
        description: "После загрузки чека мастер сразу увидит оплату и продолжит работу.",
        actionKey: "open_payment",
        cta: "К оплате",
      };
    }
    if (appointment.status === "PAYMENT_PROOF_UPLOADED") {
      return {
        title: "Чек на проверке",
        description: "Обычно подтверждение занимает 1-5 минут. Если дольше — напишите в чат.",
        actionKey: "open_chat",
        cta: "Открыть чат",
      };
    }
    if (["NEW", "IN_REVIEW"].includes(appointment.status)) {
      return {
        title: "Ожидаем мастера",
        description: "Как только мастер возьмет заявку, вы получите обновление автоматически.",
        actionKey: "open_chat",
        cta: "Открыть чат",
      };
    }
    if (["PAID", "IN_PROGRESS"].includes(appointment.status)) {
      return {
        title: "Работа выполняется",
        description: "Держите чат открытым: мастер может запросить уточнение в любой момент.",
        actionKey: "open_chat",
        cta: "Перейти в чат",
      };
    }
    if (appointment.status === "COMPLETED") {
      return {
        title: "Заявка завершена",
        description: "Проверьте результат и оставьте отзыв о работе мастера.",
        actionKey: "leave_review",
        cta: "Оставить отзыв",
      };
    }
    return {
      title: "Заявка в работе",
      description: "Все ключевые действия доступны в одном экране.",
      actionKey: "open_chat",
      cta: "Открыть чат",
    };
  })();
  const toastActionLabel =
    toast.actionKey === "open_payment"
      ? "К оплате"
      : toast.actionKey === "leave_review"
        ? "К отзыву"
        : toast.actionKey
          ? "Открыть"
          : "";

  const handlePrimaryAction = async (actionKey) => {
    if (actionKey === "open_payment") {
      if (isClient) {
        setClientTab("payment");
        if (isMobile && showClientPaymentActions) {
          setPaymentFocusOpen(true);
        }
      }
      paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_chat") {
      if (isClient) {
        setClientTab("chat");
      }
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_timeline") {
      if (isClient) {
        setClientTab(clientDetailsTabEnabled ? "details" : "chat");
      }
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "leave_review") {
      if (isClient) {
        setClientTab(clientDetailsTabEnabled ? "details" : "chat");
      }
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

  const onSelectPaymentFile = (selected) => {
    setPaymentDragOver(false);
    setPaymentProofFile(selected);
    setPaymentFileError(selected ? validatePaymentFile(selected) : "");
  };

  const triggerPaymentFilePicker = () => {
    paymentFileInputRef.current?.click();
  };

  const onPaymentDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPaymentDragOver(false);
    const selected = event.dataTransfer?.files?.[0] || null;
    onSelectPaymentFile(selected);
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
      await appointmentsApi.uploadPaymentProof(id, formData);

      let autoMarkedPaid = false;
      if (appointment?.status === "AWAITING_PAYMENT") {
        try {
          await appointmentsApi.markPaid(id, paymentMethod);
          autoMarkedPaid = true;
        } catch (markError) {
          setToast({
            open: true,
            severity: "warning",
            message: markError?.response?.data?.detail || "Чек загружен. Нажмите «Я оплатил», если статус не изменился автоматически.",
          });
        }
      }

      await loadData({ preserveDrafts: true, silent: true });
      setSuccess(autoMarkedPaid ? "Чек загружен, оплата отмечена." : "Чек загружен.");
      setError("");
      setPaymentProofFile(null);
      setPaymentFileError("");
      setToast({
        open: true,
        severity: "success",
        message: autoMarkedPaid
          ? "Чек загружен и оплата отмечена. Мастер уже видит подтверждение."
          : "Чек загружен. Проверяем оплату.",
      });
      setPaymentFocusOpen(false);
      setPaymentUploadedDialogOpen(true);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Не удалось загрузить чек. Попробуйте еще раз.";
      setError(detail);
      setToast({ open: true, severity: "error", message: detail });
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <Stack spacing={2}>
      <input
        ref={paymentFileInputRef}
        hidden
        type="file"
        onChange={(event) => onSelectPaymentFile(event.target.files?.[0] || null)}
      />
      <Paper
        sx={{
          p: { xs: 1.8, md: 2.2 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: isClient
            ? isDark
              ? "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(17,34,56,0.92) 100%)"
              : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(244,248,255,0.92) 100%)"
            : "background.paper",
          backdropFilter: "blur(16px) saturate(130%)",
          boxShadow: isClient
            ? isDark
              ? "0 18px 40px rgba(2,6,23,0.5)"
              : "0 18px 40px rgba(15,23,42,0.10)"
            : undefined,
          transition: "box-shadow .24s ease, transform .24s ease, border-color .24s ease",
          "&:hover": isClient
            ? {
                boxShadow: isDark ? "0 24px 48px rgba(2,6,23,0.62)" : "0 24px 48px rgba(15,23,42,0.14)",
                borderColor: "rgba(2,132,199,0.22)",
              }
            : undefined,
        }}
      >
        <Stack spacing={1.4}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.1}>
            <Box>
              <Typography variant="h2">Заявка #{appointment.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {normalizeRuText(appointment.brand)} {normalizeRuText(appointment.model)} • {getLockTypeLabel(appointment.lock_type)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Chip
                label={statusUi.label}
                sx={{ bgcolor: statusUi.bg, color: statusUi.color, border: `1px solid ${statusUi.color}33`, fontWeight: 700 }}
              />
              {isClient ? (
                <Button
                  size="small"
                  variant={clientCompactView ? "outlined" : "text"}
                  onClick={() => setClientCompactView((prev) => !prev)}
                  sx={{ minHeight: 28, px: 1.1, borderRadius: 2 }}
                >
                  {clientCompactView ? "Полный вид" : "Фокус"}
                </Button>
              ) : null}
            </Stack>
          </Stack>

          <StatusStepper
            status={appointment.status}
            role={user.role}
            slaBreached={appointment.sla_breached}
            compact={isMobile}
          />

          {isClient ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.3,
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: isDark ? "rgba(90,169,255,0.3)" : "rgba(2,132,199,0.16)",
                background: isDark
                  ? "linear-gradient(140deg, rgba(16,38,64,0.78) 0%, rgba(12,24,42,0.92) 100%)"
                  : "linear-gradient(140deg, rgba(237,248,255,0.92) 0%, rgba(255,255,255,0.96) 100%)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{clientFocus?.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{clientFocus?.description}</Typography>
                  {actionEtaLabel ? (
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.55 }}>
                      <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary">
                        {actionEtaLabel}
                      </Typography>
                    </Stack>
                  ) : null}
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handlePrimaryAction(clientFocus?.actionKey || "open_chat")}
                >
                  {clientFocus?.cta || "Открыть чат"}
                </Button>
              </Stack>
            </Paper>
          ) : (
            <PrimaryCTA status={appointment.status} role={user.role} onAction={handlePrimaryAction} />
          )}

          {showClientTabs ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.78)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
              }}
            >
              <Tabs
                value={clientTab}
                onChange={(_, nextValue) => setClientTab(nextValue)}
                variant="fullWidth"
                sx={{
                  minHeight: 42,
                  "& .MuiTab-root": { minHeight: 42, fontWeight: 700, fontSize: 13.5, textTransform: "none" },
                }}
              >
                <Tab
                  value="payment"
                  label="Оплата"
                  icon={<PaymentsRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  disabled={clientPaymentTabDisabled}
                />
                <Tab value="chat" label="Чат" icon={<ForumRoundedIcon fontSize="small" />} iconPosition="start" />
                {clientDetailsTabEnabled ? (
                  <Tab value="details" label="Детали" icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" />
                ) : null}
              </Tabs>
            </Paper>
          ) : null}
          {showClientQuickRail ? (
            <Paper
              elevation={0}
              sx={{
                p: 0.7,
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? "rgba(15,23,42,0.82)" : "rgba(255,255,255,0.82)",
              }}
            >
              <Stack direction="row" spacing={0.6} sx={{ overflowX: "auto", pb: 0.2 }}>
                {clientRailActions.map((action) => {
                  const active = showClientTabs ? clientTab === action.tab : false;
                  return (
                    <Button
                      key={action.id}
                      size="small"
                      startIcon={action.icon}
                      variant={active || action.emphasis ? "contained" : "text"}
                      color={active || action.emphasis ? "primary" : "inherit"}
                      onClick={() => handlePrimaryAction(action.key)}
                      sx={{
                        borderRadius: 2.2,
                        px: 1.2,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        minWidth: "fit-content",
                      }}
                    >
                      {action.label}
                    </Button>
                  );
                })}
              </Stack>
            </Paper>
          ) : null}

          {isRefreshing && !isClient ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

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
        <Grid item xs={12} lg={(!isClient || showClientDesktopSidebar) ? 8 : 12}>
          <Stack spacing={2}>
            {showClientDataCard ? (
              <Fade in={showClientDataCard} timeout={220}>
                <Box>
                  <Paper
                    sx={{
                      p: { xs: 1.8, md: 2.2 },
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      background: isClient
                        ? isDark
                          ? "linear-gradient(160deg, rgba(15,23,42,0.94) 0%, rgba(18,31,50,0.9) 100%)"
                          : "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(248,252,255,0.95) 100%)"
                        : "background.paper",
                      transition: "box-shadow .24s ease, border-color .24s ease",
                      "&:hover": isClient
                        ? {
                            boxShadow: isDark ? "0 14px 30px rgba(2,6,23,0.5)" : "0 14px 30px rgba(15,23,42,0.10)",
                            borderColor: "rgba(2,132,199,0.18)",
                          }
                        : undefined,
                    }}
                  >
                    <Typography variant="h3" sx={{ mb: 1 }}>Данные заявки</Typography>
                    {isClient ? (
                      <Stack spacing={1.1}>
                        <Typography variant="body2" color="text.secondary">
                          Главное по заявке без лишнего шума
                        </Typography>
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`Устройство: ${normalizeRuText(appointment.brand)} ${normalizeRuText(appointment.model)}`} />
                          <Chip size="small" label={`Блокировка: ${getLockTypeLabel(appointment.lock_type)}`} />
                          <Chip size="small" color={appointment.total_price ? "warning" : "default"} label={appointment.total_price ? `К оплате: ${appointment.total_price} руб.` : "Цена уточняется"} />
                          <Chip size="small" label={`Мастер: ${normalizeRuText(appointment.master_username) || "пока не назначен"}`} />
                          {rustdeskId ? <Chip size="small" icon={<ComputerRoundedIcon fontSize="small" />} label={`RuDesktop: ${rustdeskId}`} /> : null}
                        </Stack>
                        {appointment.description ? (
                          <Typography variant="body2" color="text.secondary">
                            {normalizeRuText(appointment.description)}
                          </Typography>
                        ) : null}
                      </Stack>
                    ) : (
                      <Stack spacing={0.7}>
                        <Typography variant="body2"><b>Устройство:</b> {normalizeRuText(appointment.brand)} {normalizeRuText(appointment.model)}</Typography>
                        <Typography variant="body2"><b>Тип блокировки:</b> {getLockTypeLabel(appointment.lock_type)}</Typography>
                        <Typography variant="body2"><b>Цена:</b> {appointment.total_price ? `${appointment.total_price} руб.` : "Не выставлена"}</Typography>
                        <Typography variant="body2"><b>Мастер:</b> {normalizeRuText(appointment.master_username) || appointment.assigned_master || "Пока не назначен"}</Typography>
                        <Typography variant="body2"><b>RuDesktop ID:</b> {rustdeskId || "Не указан"}</Typography>
                        {rustdeskPassword ? <Typography variant="body2"><b>RuDesktop пароль:</b> {rustdeskPassword}</Typography> : null}
                        {appointment.description ? (
                          <Typography variant="body2"><b>Комментарий:</b> {normalizeRuText(appointment.description)}</Typography>
                        ) : null}
                        <Typography variant="body2"><b>Есть ПК:</b> {appointment.has_pc ? "Да" : "Нет"}</Typography>
                        <Typography variant="body2"><b>Клиент:</b> {normalizeRuText(appointment.client_username) || appointment.client}</Typography>
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
                    )}
                  </Paper>
                </Box>
              </Fade>
            ) : null}

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

            <Fade in={showClientPaymentCard} timeout={220} mountOnEnter unmountOnExit>
              <Box>
                <Paper
                ref={paymentRef}
                sx={{
                  p: { xs: 1.8, md: 2.2 },
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: isDark ? "rgba(255,179,71,0.45)" : "warning.light",
                  background:
                    appointment.status === "AWAITING_PAYMENT"
                      ? isDark
                        ? "linear-gradient(155deg, rgba(54,38,16,0.85) 0%, rgba(20,24,34,0.98) 100%)"
                        : "linear-gradient(155deg, #fffaf0 0%, #ffffff 100%)"
                      : isDark
                        ? "linear-gradient(155deg, rgba(15,28,44,0.85) 0%, rgba(20,24,34,0.98) 100%)"
                        : "linear-gradient(155deg, #f5fbff 0%, #ffffff 100%)",
                  boxShadow: (muiTheme) =>
                    isDark
                      ? "0 10px 28px rgba(2,6,23,0.5)"
                      : `0 10px 28px ${muiTheme.palette.warning.light}2d`,
                  transition: "box-shadow .24s ease, border-color .24s ease",
                  "&:hover": { boxShadow: isDark ? "0 18px 34px rgba(2,6,23,0.6)" : "0 18px 34px rgba(15,23,42,0.12)" },
                }}
              >
                <Typography variant="h3" sx={{ mb: 0.7 }}>
                  {appointment.status === "AWAITING_PAYMENT" ? "Оплата и чек" : "Чек отправлен на проверку"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {appointment.status === "AWAITING_PAYMENT"
                    ? "Что делать дальше: 1) оплатите 2) загрузите чек. Статус оплаты отметится автоматически."
                    : "Проверяем чек. Обычно это занимает 1-5 минут. Если задержка — откройте чат и напишите мастеру."}
                </Typography>
                {isMobile ? (
                  <Button
                    variant="contained"
                    size="small"
                    sx={{ mb: 1, alignSelf: "flex-start" }}
                    onClick={() => setPaymentFocusOpen(true)}
                  >
                    Открыть быстрый режим оплаты
                  </Button>
                ) : null}
                <Stepper
                  activeStep={paymentFlowActiveStep}
                  alternativeLabel
                  sx={{
                    mb: 1.2,
                    "& .MuiStepLabel-label": {
                      fontSize: isMobile ? 11 : undefined,
                    },
                  }}
                >
                  {paymentFlowLabels.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

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
                  <Box
                    sx={paymentDropZoneSx}
                    onClick={triggerPaymentFilePicker}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setPaymentDragOver(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setPaymentDragOver(false);
                    }}
                    onDrop={onPaymentDrop}
                  >
                    <Stack spacing={0.35}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {appointment.status === "AWAITING_PAYMENT" ? "Выберите или перетащите файл чека" : "Загрузите новый чек"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Форматы: jpg, jpeg, png, pdf. Максимум 10 МБ.
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadFileRoundedIcon fontSize="small" />}
                      onClick={triggerPaymentFilePicker}
                    >
                      Выбрать файл
                    </Button>
                    {paymentProofFile ? (
                      <Button size="small" variant="text" color="inherit" onClick={() => onSelectPaymentFile(null)}>
                        Очистить
                      </Button>
                    ) : null}
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: paymentProofFile ? 700 : 500 }}>
                    {paymentProofMeta}
                  </Typography>
                  {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

                  <TextField select label="Способ оплаты" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
                    <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
                  </TextField>

                  <Button variant="contained" size="large" onClick={uploadPaymentProof} disabled={!canUploadPaymentProof}>
                    {uploadingProof ? "Загружаем чек..." : appointment.status === "AWAITING_PAYMENT" ? "Загрузить чек и продолжить" : "Отправить новый чек"}
                  </Button>
                  {uploadingProof ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

                  {appointment.status === "AWAITING_PAYMENT" ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        После загрузки статус обычно меняется автоматически за 1-2 минуты.
                      </Typography>
                      <Button size="small" variant="text" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
                        Не обновилось? Нажать «Я оплатил»
                      </Button>
                    </Stack>
                  ) : (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="outlined" onClick={() => handlePrimaryAction("open_chat")}>
                        Открыть чат
                      </Button>
                    </Stack>
                  )}
                </Stack>
                </Paper>
              </Box>
            </Fade>

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

            {showClientRepeat && showClientSecondaryCards ? (
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

            {showClientReview && showClientSecondaryCards ? (
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

            <Fade in={showClientChatPanel} timeout={220} mountOnEnter unmountOnExit>
              <Box ref={chatRef}>
                <ChatPanel appointmentId={id} currentUser={user} systemEvents={mappedSystemEvents} />
              </Box>
            </Fade>

            <Fade in={showClientDetailsCard} timeout={220} mountOnEnter unmountOnExit>
              <Box ref={timelineRef}>
                <Accordion
                  disableGutters
                  sx={{
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: isDark ? "0 8px 24px rgba(2,6,23,0.45)" : "0 8px 24px rgba(15,23,42,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Stack spacing={0.25}>
                      <Typography variant="h3">Подробнее по заказу</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Доверие, сроки и последние события
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.2}>
                      <Typography variant="body2"><b>Мастер:</b> {normalizeRuText(appointment.master_username) || "Пока не назначен"}</Typography>
                      <Typography variant="body2"><b>SLA ответ до:</b> {appointment.response_deadline_at ? dayjs(appointment.response_deadline_at).format("DD.MM.YYYY HH:mm") : "—"}</Typography>
                      <Typography variant="body2"><b>SLA завершение до:</b> {appointment.completion_deadline_at ? dayjs(appointment.completion_deadline_at).format("DD.MM.YYYY HH:mm") : "—"}</Typography>
                      {appointment.sla_breached ? (
                        <Alert severity="warning" sx={{ py: 0 }}>
                          Мы уже подключили администратора, чтобы ускорить процесс.
                        </Alert>
                      ) : null}
                      <Divider />
                      <Typography variant="subtitle2">Последние события</Typography>
                      {visibleTimelineEvents.length ? (
                        <Stack spacing={0.9}>
                          {visibleTimelineEvents.slice(0, 6).map((event) => (
                            <Stack key={event.id} spacing={0.25}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{getEventTitle(event)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Событий пока нет.</Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Box>
            </Fade>
          </Stack>
        </Grid>

        {(!isClient || showClientDesktopSidebar) ? (
          <Grid item xs={12} lg={4}>
            <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: { lg: 88 } }}>
              <Paper sx={{ p: 2.2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ShieldRoundedIcon color="primary" fontSize="small" />
                <Typography variant="h3">{isClient ? "Быстрый контроль" : "Доверие и прозрачность"}</Typography>
              </Stack>

              <Stack spacing={0.7}>
                <Typography variant="body2"><b>Мастер:</b> {normalizeRuText(appointment.master_username) || "Пока не назначен"}</Typography>
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
                ) : (
                  <>
                    <Divider sx={{ my: 0.7 }} />
                    <Stack spacing={0.6}>
                      {clientSidebarActions.map((action) => (
                        <Button
                          key={`sidebar-${action.id}`}
                          size="small"
                          startIcon={action.icon}
                          variant={action.emphasis ? "contained" : "outlined"}
                          onClick={() => handlePrimaryAction(action.key)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>

              <Paper sx={{ p: 2.2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <LinkRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="h3">Ссылки и подключение</Typography>
                </Stack>
                <Stack spacing={0.9}>
                  <Typography variant="caption" color="text.secondary">
                    Все нужные ссылки собраны справа, чтобы не искать их в переписке.
                  </Typography>

                  {rustdeskId ? (
                    <Stack spacing={0.8}>
                      <Chip
                        size="small"
                        icon={<ComputerRoundedIcon fontSize="small" />}
                        label={`RuDesktop ID: ${rustdeskId}`}
                        sx={{ alignSelf: "flex-start" }}
                      />
                      {hasRuDesktopCredentials ? (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<ComputerRoundedIcon fontSize="small" />}
                          onClick={() => openRuDesktopSession(rustdeskId, rustdeskPassword)}
                          sx={{ alignSelf: "flex-start" }}
                          disabled={!canLaunchRuDesktop}
                        >
                          Подключиться через сайт
                        </Button>
                      ) : null}
                      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                          onClick={() => copyToClipboard(rustdeskId, "RuDesktop ID не указан")}
                        >
                          Копировать ID
                        </Button>
                        {rustdeskPassword ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                            onClick={() => copyToClipboard(rustdeskPassword, "Пароль RuDesktop не указан")}
                          >
                            Копировать пароль
                          </Button>
                        ) : null}
                      </Stack>
                      {hasRuDesktopCredentials ? (
                        <Typography variant="caption" color="text.secondary">
                          {canLaunchRuDesktop
                            ? "Кнопка откроет RuDesktop на вашем устройстве и скопирует ID/пароль в буфер."
                            : "Подключение станет доступно после подтверждения оплаты и перехода заявки в работу."}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    <Alert
                      severity={isClient ? "info" : "warning"}
                      action={(
                        <Button size="small" color="inherit" onClick={() => handlePrimaryAction("open_chat")}>
                          В чат
                        </Button>
                      )}
                    >
                      {isClient
                        ? "RuDesktop ID пока не указан. Отправьте его в чат, чтобы мастер подключился быстрее."
                        : "Клиент еще не указал RuDesktop ID. Запросите его в чате."}
                    </Alert>
                  )}

                  <Stack spacing={0.6}>
                    {sidebarLinks.map((item) => (
                      <Button
                        key={item.id}
                        size="small"
                        variant="outlined"
                        component="a"
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        startIcon={<OpenInNewRoundedIcon fontSize="small" />}
                        sx={{ justifyContent: "flex-start" }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              </Paper>

              <Paper ref={timelineRef} sx={{ p: 2.2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <TimelineRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="h3">{isClient ? "Статус и история" : "Лента событий"}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Обновляется автоматически каждые 3-4 секунды
                </Typography>

                {sidebarTimelineEvents.length ? (
                  <Stack spacing={1}>
                    {sidebarTimelineEvents.map((event, index) => (
                      <Stack key={event.id} spacing={0.35}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{getEventTitle(event)}</Typography>
                        {event.note ? <Typography variant="caption" color="text.secondary">{normalizeRuText(event.note)}</Typography> : null}
                        <Typography variant="caption" color="text.secondary">
                          {normalizeRuText(event.actor_username) || "Система"} • {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                        </Typography>
                        {index < sidebarTimelineEvents.length - 1 ? <Divider /> : null}
                      </Stack>
                    ))}
                    {isClient && visibleTimelineEvents.length > sidebarTimelineEvents.length ? (
                      <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
                        Показать больше событий
                      </Button>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">События пока отсутствуют.</Typography>
                )}
              </Paper>
            </Stack>
          </Grid>
        ) : null}
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
            border: "1px solid",
            borderColor: "divider",
            bgcolor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px) saturate(125%)",
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
            borderColor: isDark ? "rgba(255,179,71,0.5)" : "warning.light",
            boxShadow: (theme) =>
              isDark ? "0 18px 42px rgba(2,6,23,0.62)" : `0 18px 42px ${theme.palette.warning.light}55`,
            bgcolor: isDark ? "rgba(22,27,38,0.95)" : "#fffdfa",
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
                ? "Сначала оплатите и загрузите чек. Статус оплаты отмечается автоматически, обычно за 1-2 минуты."
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
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={paymentFocusOpen}
          onClose={() => setPaymentFocusOpen(false)}
          PaperProps={{
            sx: {
              p: 1.6,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "88vh",
              overflowY: "auto",
              background: isDark
                ? "linear-gradient(160deg, rgba(10,17,31,0.98) 0%, rgba(15,23,42,0.98) 100%)"
                : "linear-gradient(160deg, rgba(255,255,255,0.99) 0%, rgba(246,251,255,0.98) 100%)",
            },
          }}
        >
          <Stack spacing={1.2}>
            <Stack spacing={0.3}>
              <Typography variant="h3" sx={{ fontWeight: 800 }}>
                {isAwaitingPayment ? "Быстрый режим оплаты" : "Чек на проверке"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isAwaitingPayment
                  ? "Оплатите, загрузите чек и сразу переходите в чат."
                  : "Чек уже у мастера. Если есть вопрос — откройте чат."}
              </Typography>
            </Stack>

            <Stepper activeStep={paymentFlowActiveStep} alternativeLabel>
              {paymentFlowLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Stack spacing={0.4}>
              <Typography variant="body2">
                <b>Банк:</b> {paymentSettings?.bank_requisites || "не указано"}
              </Typography>
              <Typography variant="body2">
                <b>Криптовалюта:</b> {paymentSettings?.crypto_requisites || "не указано"}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                onClick={() => copyToClipboard(paymentSettings?.bank_requisites)}
              >
                Банк
              </Button>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                onClick={() => copyToClipboard(paymentSettings?.crypto_requisites)}
              >
                Крипта
              </Button>
            </Stack>

            <TextField
              select
              label="Способ оплаты"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
              <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
            </TextField>

            <Box
              sx={paymentDropZoneSx}
              onClick={triggerPaymentFilePicker}
              onDragOver={(event) => {
                event.preventDefault();
                setPaymentDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setPaymentDragOver(false);
              }}
              onDrop={onPaymentDrop}
            >
              <Stack spacing={0.35}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {isAwaitingPayment ? "Выберите или перетащите файл чека" : "Загрузите новый чек"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Форматы: jpg, jpeg, png, pdf. Максимум 10 МБ.
                </Typography>
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<UploadFileRoundedIcon fontSize="small" />}
                onClick={triggerPaymentFilePicker}
              >
                Выбрать файл
              </Button>
              {paymentProofFile ? (
                <Button fullWidth size="small" onClick={() => onSelectPaymentFile(null)}>
                  Очистить
                </Button>
              ) : null}
            </Stack>

            <Typography variant="body2" sx={{ fontWeight: paymentProofFile ? 700 : 500 }}>
              {paymentProofMeta}
            </Typography>
            {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

            <Button
              variant="contained"
              size="large"
              onClick={uploadPaymentProof}
              disabled={!canUploadPaymentProof}
            >
              {uploadingProof
                ? "Загружаем чек..."
                : isAwaitingPayment
                  ? "Загрузить чек и продолжить"
                  : "Отправить новый чек"}
            </Button>
            {uploadingProof ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

            {isAwaitingPayment ? (
              <Button size="small" variant="text" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
                Не обновилось? Нажать «Я оплатил»
              </Button>
            ) : null}

            <Stack direction="row" spacing={1}>
              <Button fullWidth onClick={() => setPaymentFocusOpen(false)}>Закрыть</Button>
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  setPaymentFocusOpen(false);
                  handlePrimaryAction("open_chat");
                }}
              >
                Открыть чат
              </Button>
            </Stack>
          </Stack>
        </Drawer>
      ) : null}
      <Dialog
        open={paymentFocusOpen && !isMobile}
        onClose={() => setPaymentFocusOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            border: "1px solid",
            borderColor: "divider",
            background: isDark
              ? "linear-gradient(160deg, rgba(10,17,31,0.98) 0%, rgba(15,23,42,0.96) 100%)"
              : "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(246,251,255,0.96) 100%)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 0.8 }}>
          <Stack spacing={0.4}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              {isAwaitingPayment ? "Быстрый режим оплаты" : "Быстрый режим проверки"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isAwaitingPayment
                ? "Оплата -> чек -> подтверждение. Все в одном окне."
                : "Чек отправлен. При необходимости напишите мастеру в чат."}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Stepper activeStep={paymentFlowActiveStep} alternativeLabel>
              {paymentFlowLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Stack spacing={0.4}>
              <Typography variant="body2">
                <b>Банк:</b> {paymentSettings?.bank_requisites || "не указано"}
              </Typography>
              <Typography variant="body2">
                <b>Криптовалюта:</b> {paymentSettings?.crypto_requisites || "не указано"}
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                onClick={() => copyToClipboard(paymentSettings?.bank_requisites)}
              >
                Скопировать банк
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                onClick={() => copyToClipboard(paymentSettings?.crypto_requisites)}
              >
                Скопировать крипту
              </Button>
            </Stack>

            <TextField
              select
              label="Способ оплаты"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
              <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
            </TextField>

            <Box
              component="label"
              sx={paymentDropZoneSx}
              onDragOver={(event) => {
                event.preventDefault();
                setPaymentDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setPaymentDragOver(false);
              }}
              onDrop={onPaymentDrop}
            >
              <Stack spacing={0.35}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {isAwaitingPayment ? "Выберите или перетащите файл чека" : "Загрузите новый чек"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Форматы: jpg, jpeg, png, pdf. Максимум 10 МБ.
                </Typography>
              </Stack>
              <input hidden type="file" onChange={(event) => onSelectPaymentFile(event.target.files?.[0] || null)} />
            </Box>
            <Typography variant="body2">{paymentProofFile ? paymentProofFile.name : "Файл не выбран"}</Typography>
            {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

            <Button
              variant="contained"
              size="large"
              onClick={uploadPaymentProof}
              disabled={!canUploadPaymentProof}
            >
              {uploadingProof
                ? "Загружаем чек..."
                : isAwaitingPayment
                  ? "Загрузить чек и продолжить"
                  : "Отправить новый чек"}
            </Button>

            {isAwaitingPayment ? (
              <Button size="small" variant="text" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
                Не обновилось? Нажать «Я оплатил»
              </Button>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setPaymentFocusOpen(false)}>Закрыть</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPaymentFocusOpen(false);
              handlePrimaryAction("open_chat");
            }}
          >
            Открыть чат
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={paymentGuideOpen}
        onClose={() => setPaymentGuideOpen(false)}
        fullWidth
        fullScreen={isMobile}
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: isDark ? "1px solid rgba(90,169,255,0.28)" : "1px solid rgba(15,23,42,0.08)",
            background: isDark
              ? "linear-gradient(145deg, rgba(10,17,31,0.96) 0%, rgba(17,30,48,0.94) 100%)"
              : "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(243,249,255,0.94) 100%)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={0.6}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              {isAwaitingPayment ? "Следующий шаг: оплата и чек" : "Чек отправлен, ожидаем подтверждение"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAwaitingPayment
                ? "Оплатите по реквизитам и загрузите чек. Обычно статус оплаты обновляется за 1-2 минуты."
                : "Проверка чека обычно занимает 1-5 минут. Если дольше, напишите мастеру в чат."}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            <Stepper activeStep={paymentFlowActiveStep} alternativeLabel>
              {paymentFlowLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            <Alert severity={isAwaitingPayment ? "info" : "success"} sx={{ py: 0.6 }}>
              {isAwaitingPayment
                ? "1) Оплата -> 2) Загрузка чека -> 3) Подтверждение. После этого мастер продолжит работу."
                : "Чек получен. Оставьте чат открытым, если мастер запросит уточнение."}
            </Alert>
            {isPaymentProofUploaded && paymentReviewMinutes != null ? (
              <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ py: 0 }}>
                {paymentReviewMinutes < 1
                  ? "Проверка началась только что."
                  : `Проверка чека идет ${paymentReviewMinutes} мин.`}
              </Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Если что-то не получается, нажмите «Открыть чат» и отправьте одно короткое сообщение мастеру.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setPaymentGuideOpen(false)}>Позже</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPaymentGuideOpen(false);
              handlePrimaryAction(isAwaitingPayment ? "open_payment" : "open_chat");
            }}
          >
            {isAwaitingPayment ? "Перейти к оплате" : "Открыть чат"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={paymentUploadedDialogOpen}
        onClose={() => setPaymentUploadedDialogOpen(false)}
        fullWidth
        fullScreen={isMobile}
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: isDark ? "1px solid rgba(67,209,122,0.35)" : "1px solid rgba(16,185,129,0.25)",
            background: isDark
              ? "linear-gradient(145deg, rgba(11,22,34,0.98) 0%, rgba(14,38,31,0.96) 100%)"
              : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.98) 100%)",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Чек загружен</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Alert severity="success" sx={{ py: 0.6 }}>
              Чек отправлен на проверку. Мастер уже видит подтверждение в заявке.
            </Alert>
            <Typography variant="body2">
              Если статус не изменился автоматически, нажмите «Я оплатил» в блоке оплаты.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Если ответа нет дольше 10 минут, откройте чат и напишите мастеру.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
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
        autoHideDuration={3200}
        onClose={() => setToast((prev) => ({ ...prev, open: false, actionKey: "" }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false, actionKey: "" }))}
          action={
            isClient && toast.actionKey ? (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  const actionKey = toast.actionKey;
                  setToast((prev) => ({ ...prev, open: false, actionKey: "" }));
                  handlePrimaryAction(actionKey);
                }}
              >
                {toastActionLabel}
              </Button>
            ) : null
          }
          sx={{
            width: "100%",
            borderRadius: 2.2,
            boxShadow: isDark ? "0 12px 28px rgba(2,6,23,0.56)" : "0 10px 24px rgba(15,23,42,0.14)",
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

