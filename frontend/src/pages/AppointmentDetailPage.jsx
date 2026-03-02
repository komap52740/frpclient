import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
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

dayjs.locale("ru");

const behaviorFlags = [
  { code: "bad_internet", label: "РџСЂРѕР±Р»РµРјРЅС‹Р№ РёРЅС‚РµСЂРЅРµС‚" },
  { code: "weak_pc", label: "РЎР»Р°Р±С‹Р№ РџРљ" },
  { code: "difficult_client", label: "РЎР»РѕР¶РЅС‹Р№ РєР»РёРµРЅС‚" },
  { code: "did_not_follow_instructions", label: "РќРµ СЃР»РµРґРѕРІР°Р» РёРЅСЃС‚СЂСѓРєС†РёСЏРј" },
  { code: "late_to_session", label: "РћРїРѕР·РґР°Р» Рє РїРѕРґРєР»СЋС‡РµРЅРёСЋ" },
  { code: "good_connection", label: "РћС‚Р»РёС‡РЅР°СЏ СЃРІСЏР·СЊ" },
  { code: "well_prepared", label: "РџРѕРґРіРѕС‚РѕРІР»РµРЅ Р·Р°СЂР°РЅРµРµ" },
];

const CLIENT_SIGNAL_OPTIONS = [
  {
    value: "ready_for_session",
    label: "Р“РѕС‚РѕРІ Рє РїРѕРґРєР»СЋС‡РµРЅРёСЋ",
    helper: "РЎРѕРѕР±С‰РёС‚СЊ РјР°СЃС‚РµСЂСѓ, С‡С‚Рѕ РџРљ Рё РёРЅС‚РµСЂРЅРµС‚ СѓР¶Рµ РіРѕС‚РѕРІС‹.",
  },
  {
    value: "need_help",
    label: "РќСѓР¶РЅР° РїРѕРјРѕС‰СЊ РїРѕ С€Р°РіР°Рј",
    helper: "Р•СЃР»Рё РЅРµ РїРѕР»СѓС‡Р°РµС‚СЃСЏ РїСЂРѕР№С‚Рё С€Р°РіРё СЃР°РјРѕСЃС‚РѕСЏС‚РµР»СЊРЅРѕ.",
  },
  {
    value: "payment_issue",
    label: "РџСЂРѕР±Р»РµРјР° СЃ РѕРїР»Р°С‚РѕР№",
    helper: "Р•СЃР»Рё РѕРїР»Р°С‚Р° РЅРµ РїСЂРѕС…РѕРґРёС‚ РёР»Рё РµСЃС‚СЊ РІРѕРїСЂРѕСЃ РїРѕ СЂРµРєРІРёР·РёС‚Р°Рј.",
  },
  {
    value: "need_reschedule",
    label: "РќСѓР¶РЅРѕ РїРµСЂРµРЅРµСЃС‚Рё СЃРµСЃСЃРёСЋ",
    helper: "Р•СЃР»Рё РїРѕРґРєР»СЋС‡РµРЅРёРµ РЅСѓР¶РЅРѕ РЅР° РґСЂСѓРіРѕРµ РІСЂРµРјСЏ.",
  },
];

const EVENT_LABELS = {
  status_changed: "РЎРјРµРЅР° СЃС‚Р°С‚СѓСЃР°",
  price_set: "РќР°Р·РЅР°С‡РµРЅР° С†РµРЅР°",
  payment_proof_uploaded: "Р—Р°РіСЂСѓР¶РµРЅ С‡РµРє",
  payment_marked: "РљР»РёРµРЅС‚ РѕС‚РјРµС‚РёР» РѕРїР»Р°С‚Сѓ",
  payment_confirmed: "РћРїР»Р°С‚Р° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°",
  message_deleted: "РЈРґР°Р»РµРЅРѕ СЃРѕРѕР±С‰РµРЅРёРµ",
  client_signal: "РЎРёРіРЅР°Р» РєР»РёРµРЅС‚Р°",
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
    actor_username: appointment.client_username || "РљР»РёРµРЅС‚",
    note: "Р—Р°СЏРІРєР° СЃРѕР·РґР°РЅР°",
  });
  push("status_changed", appointment.taken_at, {
    from_status: "NEW",
    to_status: "IN_REVIEW",
    note: "Р—Р°СЏРІРєР° РІР·СЏС‚Р° РјР°СЃС‚РµСЂРѕРј",
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
    note: "РўРµРєСѓС‰РµРµ СЃРѕСЃС‚РѕСЏРЅРёРµ Р·Р°СЏРІРєРё",
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
    return "Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р» С‡РµРєР°";
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "pdf"];
  if (!allowed.includes(ext)) {
    return "Р¤РѕСЂРјР°С‚ С„Р°Р№Р»Р°: jpg, jpeg, png РёР»Рё pdf";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Р Р°Р·РјРµСЂ С„Р°Р№Р»Р° РЅРµ РґРѕР»Р¶РµРЅ РїСЂРµРІС‹С€Р°С‚СЊ 10 РњР‘";
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
    return "вЂ”";
  }
  if (minutes <= 0) {
    return "СЃСЂРѕРє РЅР°СЃС‚СѓРїРёР»";
  }
  if (minutes < 60) {
    return `~${minutes} РјРёРЅ`;
  }
  const hours = Math.ceil(minutes / 60);
  return `~${hours} С‡`;
}

export default function AppointmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, paymentSettings } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
        setError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°СЏРІРєСѓ");
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
          setError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р»РµРЅС‚Сѓ СЃРѕР±С‹С‚РёР№");
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
        setClientTab("details");
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
  }, [appointment?.id, appointment?.status, searchParams, user?.role]);

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
    setClientTab((prev) => (prev === "payment" ? "chat" : prev));
  }, [appointment?.id, appointment?.status, user?.role]);

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
      setSuccess("Р”РµР№СЃС‚РІРёРµ РІС‹РїРѕР»РЅРµРЅРѕ");
      setError("");
      setToast({ open: true, severity: "success", message: "Р”РµР№СЃС‚РІРёРµ РІС‹РїРѕР»РЅРµРЅРѕ" });
      return true;
    } catch (err) {
      const detailMessage = err.response?.data?.detail || "РћС€РёР±РєР° РІС‹РїРѕР»РЅРµРЅРёСЏ РґРµР№СЃС‚РІРёСЏ";
      setSuccess("");
      setError(err.response?.data?.detail || "РћС€РёР±РєР° РІС‹РїРѕР»РЅРµРЅРёСЏ РґРµР№СЃС‚РІРёСЏ");
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
      setSuccess(`РЎРёРіРЅР°Р» РѕС‚РїСЂР°РІР»РµРЅ: ${selectedSignal.label}`);
    }
  };

  const repeatAppointment = async () => {
    try {
      const response = await appointmentsApi.repeat(id);
      navigate(`/appointments/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїРѕРІС‚РѕСЂРЅСѓСЋ Р·Р°СЏРІРєСѓ");
    }
  };

  const copyToClipboard = async (value) => {
    const text = (value || "").trim();
    if (!text) {
      setError("Р РµРєРІРёР·РёС‚С‹ РїРѕРєР° РЅРµ Р·Р°РїРѕР»РЅРµРЅС‹ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("РЎРєРѕРїРёСЂРѕРІР°РЅРѕ РІ Р±СѓС„РµСЂ РѕР±РјРµРЅР°");
    } catch {
      setError("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё. РЎРєРѕРїРёСЂСѓР№С‚Рµ С‚РµРєСЃС‚ РІСЂСѓС‡РЅСѓСЋ.");
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
  const showClientTabs = user.role === "client";

  const showMasterTake = user.role === "master" && appointment.status === "NEW";
  const showMasterReviewAndPrice = isMasterAssigned && appointment.status === "IN_REVIEW";
  const showMasterConfirmPayment = isMasterAssigned && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showMasterStart = isMasterAssigned && appointment.status === "PAID";
  const showMasterComplete = isMasterAssigned && appointment.status === "IN_PROGRESS";
  const showMasterReviewClient = isMasterAssigned && appointment.status === "COMPLETED";

  const showAdminControls = user.role === "admin";
  const showAdminPaymentConfirm = showAdminControls && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showClientPaymentHighlight = false;
  const showClientPaymentDock = false;
  const showClientFloatingActionBar = false;
  const clientPaymentTabDisabled = !showClientPaymentActions;
  const showClientDataCard = !showClientTabs || clientTab === "details";
  const showClientPaymentCard = showClientPaymentActions && (!showClientTabs || clientTab === "payment");
  const showClientChatPanel = !showClientTabs || clientTab === "chat";
  const showClientDetailsCard = showClientTabs && clientTab === "details";
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
  const paymentDropZoneSx = {
    p: 1.1,
    borderRadius: 2,
    border: "1px dashed",
    borderColor: paymentDragOver ? "primary.main" : "divider",
    bgcolor: paymentDragOver ? "rgba(2,132,199,0.06)" : "rgba(255,255,255,0.72)",
    transition: "all .2s ease",
    cursor: "pointer",
  };
  const lastSyncLabel = dayjs(lastSyncedAt).format("HH:mm:ss");
  const visibleTimelineEvents = isClient ? timelineEvents.slice(0, 8) : timelineEvents;

  const statusUi = resolveStatusUI(appointment.status, appointment.sla_breached);
  const clientFocus = (() => {
    if (!isClient) {
      return null;
    }
    if (appointment.status === "AWAITING_PAYMENT") {
      return {
        title: "РћРїР»Р°С‚РёС‚Рµ Рё РїСЂРёРєСЂРµРїРёС‚Рµ С‡РµРє",
        description: "РџРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё С‡РµРєР° РјР°СЃС‚РµСЂ СЃСЂР°Р·Сѓ СѓРІРёРґРёС‚ РѕРїР»Р°С‚Сѓ Рё РїСЂРѕРґРѕР»Р¶РёС‚ СЂР°Р±РѕС‚Сѓ.",
        actionKey: "open_payment",
        cta: "Рљ РѕРїР»Р°С‚Рµ",
      };
    }
    if (appointment.status === "PAYMENT_PROOF_UPLOADED") {
      return {
        title: "Р§РµРє РЅР° РїСЂРѕРІРµСЂРєРµ",
        description: "РћР±С‹С‡РЅРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ Р·Р°РЅРёРјР°РµС‚ 1-5 РјРёРЅСѓС‚. Р•СЃР»Рё РґРѕР»СЊС€Рµ вЂ” РЅР°РїРёС€РёС‚Рµ РІ С‡Р°С‚.",
        actionKey: "open_chat",
        cta: "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚",
      };
    }
    if (["NEW", "IN_REVIEW"].includes(appointment.status)) {
      return {
        title: "РћР¶РёРґР°РµРј РјР°СЃС‚РµСЂР°",
        description: "РљР°Рє С‚РѕР»СЊРєРѕ РјР°СЃС‚РµСЂ РІРѕР·СЊРјРµС‚ Р·Р°СЏРІРєСѓ, РІС‹ РїРѕР»СѓС‡РёС‚Рµ РѕР±РЅРѕРІР»РµРЅРёРµ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.",
        actionKey: "open_chat",
        cta: "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚",
      };
    }
    if (["PAID", "IN_PROGRESS"].includes(appointment.status)) {
      return {
        title: "Р Р°Р±РѕС‚Р° РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ",
        description: "Р”РµСЂР¶РёС‚Рµ С‡Р°С‚ РѕС‚РєСЂС‹С‚С‹Рј: РјР°СЃС‚РµСЂ РјРѕР¶РµС‚ Р·Р°РїСЂРѕСЃРёС‚СЊ СѓС‚РѕС‡РЅРµРЅРёРµ РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚.",
        actionKey: "open_chat",
        cta: "РџРµСЂРµР№С‚Рё РІ С‡Р°С‚",
      };
    }
    if (appointment.status === "COMPLETED") {
      return {
        title: "Р—Р°СЏРІРєР° Р·Р°РІРµСЂС€РµРЅР°",
        description: "РџСЂРѕРІРµСЂСЊС‚Рµ СЂРµР·СѓР»СЊС‚Р°С‚ Рё РѕСЃС‚Р°РІСЊС‚Рµ РѕС‚Р·С‹РІ Рѕ СЂР°Р±РѕС‚Рµ РјР°СЃС‚РµСЂР°.",
        actionKey: "leave_review",
        cta: "РћСЃС‚Р°РІРёС‚СЊ РѕС‚Р·С‹РІ",
      };
    }
    return {
      title: "Р—Р°СЏРІРєР° РІ СЂР°Р±РѕС‚Рµ",
      description: "Р’СЃРµ РєР»СЋС‡РµРІС‹Рµ РґРµР№СЃС‚РІРёСЏ РґРѕСЃС‚СѓРїРЅС‹ РІ РѕРґРЅРѕРј СЌРєСЂР°РЅРµ.",
      actionKey: "open_chat",
      cta: "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚",
    };
  })();

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
        setClientTab("details");
      }
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "leave_review") {
      if (isClient) {
        setClientTab("details");
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
        setError("РЈРєР°Р¶РёС‚Рµ С†РµРЅСѓ РІ СЂСѓР±Р»СЏС…");
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
            message: markError?.response?.data?.detail || "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ. РќР°Р¶РјРёС‚Рµ В«РЇ РѕРїР»Р°С‚РёР»В», РµСЃР»Рё СЃС‚Р°С‚СѓСЃ РЅРµ РёР·РјРµРЅРёР»СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.",
          });
        }
      }

      await loadData({ preserveDrafts: true, silent: true });
      setSuccess(autoMarkedPaid ? "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ, РѕРїР»Р°С‚Р° РѕС‚РјРµС‡РµРЅР°." : "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ.");
      setError("");
      setPaymentProofFile(null);
      setPaymentFileError("");
      setToast({
        open: true,
        severity: "success",
        message: autoMarkedPaid
          ? "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ Рё РѕРїР»Р°С‚Р° РѕС‚РјРµС‡РµРЅР°. РњР°СЃС‚РµСЂ СѓР¶Рµ РІРёРґРёС‚ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ."
          : "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ. РџСЂРѕРІРµСЂСЏРµРј РѕРїР»Р°С‚Сѓ.",
      });
      setPaymentFocusOpen(false);
      setPaymentUploadedDialogOpen(true);
    } catch (err) {
      const detail = err?.response?.data?.detail || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С‡РµРє. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·.";
      setError(detail);
      setToast({ open: true, severity: "error", message: detail });
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.8, md: 2.2 },
          borderRadius: 3,
          border: "1px solid rgba(15,23,42,0.08)",
          background: isClient
            ? "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(244,248,255,0.92) 100%)"
            : "background.paper",
          backdropFilter: "blur(16px) saturate(130%)",
          boxShadow: isClient ? "0 18px 40px rgba(15,23,42,0.10)" : undefined,
          transition: "box-shadow .24s ease, transform .24s ease, border-color .24s ease",
          "&:hover": isClient ? { boxShadow: "0 24px 48px rgba(15,23,42,0.14)", borderColor: "rgba(2,132,199,0.22)" } : undefined,
        }}
      >
        <Stack spacing={1.4}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.1}>
            <Box>
              <Typography variant="h2">Р—Р°СЏРІРєР° #{appointment.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {appointment.brand} {appointment.model} вЂў {getLockTypeLabel(appointment.lock_type)}
              </Typography>
            </Box>
            <Chip
              label={statusUi.label}
              sx={{ bgcolor: statusUi.bg, color: statusUi.color, border: `1px solid ${statusUi.color}33`, fontWeight: 700 }}
            />
          </Stack>

          <StatusStepper status={appointment.status} role={user.role} slaBreached={appointment.sla_breached} />

          {isClient ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.3,
                borderRadius: 2.5,
                border: "1px solid rgba(2,132,199,0.16)",
                background: "linear-gradient(140deg, rgba(237,248,255,0.92) 0%, rgba(255,255,255,0.96) 100%)",
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
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handlePrimaryAction(clientFocus?.actionKey || "open_chat")}
                >
                  {clientFocus?.cta || "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚"}
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
                border: "1px solid rgba(15,23,42,0.08)",
                bgcolor: "rgba(255,255,255,0.78)",
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
                <Tab value="payment" label="РћРїР»Р°С‚Р°" disabled={clientPaymentTabDisabled} />
                <Tab value="chat" label="Р§Р°С‚" />
                <Tab value="details" label="Р”РµС‚Р°Р»Рё" />
              </Tabs>
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
              {isRefreshing ? "РћР±РЅРѕРІР»СЏРµРј СЃС‚Р°С‚СѓСЃ Рё С‡Р°С‚..." : `РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ: ${lastSyncLabel}`}
            </Typography>
            {user.role !== "client" ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_payment")}>
                  Рљ РѕРїР»Р°С‚Рµ
                </Button>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_chat")}>
                  Рљ С‡Р°С‚Сѓ
                </Button>
                <Button size="small" variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
                  Рљ Р»РµРЅС‚Рµ
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
              РџРµСЂРµР№С‚Рё
            </Button>
          }
        >
          {appointment.status === "AWAITING_PAYMENT"
            ? "РЎРµР№С‡Р°СЃ РіР»Р°РІРЅС‹Р№ С€Р°Рі: РѕРїР»Р°С‚Р° Рё Р·Р°РіСЂСѓР·РєР° С‡РµРєР°. РџРѕСЃР»Рµ СЌС‚РѕРіРѕ РјР°СЃС‚РµСЂ СЃСЂР°Р·Сѓ РїСЂРѕРґРѕР»Р¶РёС‚ СЂР°Р±РѕС‚Сѓ."
            : "Р§РµРє Р·Р°РіСЂСѓР¶РµРЅ Рё СѓР¶Рµ РЅР° РїСЂРѕРІРµСЂРєРµ. РћР±С‹С‡РЅРѕ СЌС‚Рѕ Р·Р°РЅРёРјР°РµС‚ 1-5 РјРёРЅСѓС‚."}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={isClient ? 12 : 8}>
          <Stack spacing={2}>
            {showClientDataCard ? (
              <Paper
                sx={{
                  p: { xs: 1.8, md: 2.2 },
                  borderRadius: 3,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: isClient
                    ? "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(248,252,255,0.95) 100%)"
                    : "background.paper",
                  transition: "box-shadow .24s ease, border-color .24s ease",
                  "&:hover": isClient ? { boxShadow: "0 14px 30px rgba(15,23,42,0.10)", borderColor: "rgba(2,132,199,0.18)" } : undefined,
                }}
              >
                <Typography variant="h3" sx={{ mb: 1 }}>Р”Р°РЅРЅС‹Рµ Р·Р°СЏРІРєРё</Typography>
                {isClient ? (
                  <Stack spacing={1.1}>
                    <Typography variant="body2" color="text.secondary">
                      Р“Р»Р°РІРЅРѕРµ РїРѕ Р·Р°СЏРІРєРµ Р±РµР· Р»РёС€РЅРµРіРѕ С€СѓРјР°
                    </Typography>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`РЈСЃС‚СЂРѕР№СЃС‚РІРѕ: ${appointment.brand} ${appointment.model}`} />
                      <Chip size="small" label={`Р‘Р»РѕРєРёСЂРѕРІРєР°: ${getLockTypeLabel(appointment.lock_type)}`} />
                      <Chip size="small" color={appointment.total_price ? "warning" : "default"} label={appointment.total_price ? `Рљ РѕРїР»Р°С‚Рµ: ${appointment.total_price} СЂСѓР±.` : "Р¦РµРЅР° СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ"} />
                      <Chip size="small" label={`РњР°СЃС‚РµСЂ: ${appointment.master_username || "РїРѕРєР° РЅРµ РЅР°Р·РЅР°С‡РµРЅ"}`} />
                    </Stack>
                    {appointment.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {appointment.description}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Stack spacing={0.7}>
                    <Typography variant="body2"><b>РЈСЃС‚СЂРѕР№СЃС‚РІРѕ:</b> {appointment.brand} {appointment.model}</Typography>
                    <Typography variant="body2"><b>РўРёРї Р±Р»РѕРєРёСЂРѕРІРєРё:</b> {getLockTypeLabel(appointment.lock_type)}</Typography>
                    <Typography variant="body2"><b>Р¦РµРЅР°:</b> {appointment.total_price ? `${appointment.total_price} СЂСѓР±.` : "РќРµ РІС‹СЃС‚Р°РІР»РµРЅР°"}</Typography>
                    <Typography variant="body2"><b>РњР°СЃС‚РµСЂ:</b> {appointment.master_username || appointment.assigned_master || "РџРѕРєР° РЅРµ РЅР°Р·РЅР°С‡РµРЅ"}</Typography>
                    {appointment.description ? (
                      <Typography variant="body2"><b>РљРѕРјРјРµРЅС‚Р°СЂРёР№:</b> {appointment.description}</Typography>
                    ) : null}
                    <Typography variant="body2"><b>Р•СЃС‚СЊ РџРљ:</b> {appointment.has_pc ? "Р”Р°" : "РќРµС‚"}</Typography>
                    <Typography variant="body2"><b>РљР»РёРµРЅС‚:</b> {appointment.client_username || appointment.client}</Typography>
                    {appointment.photo_lock_screen_url ? (
                      <Typography variant="body2">
                        <a href={appointment.photo_lock_screen_url} target="_blank" rel="noreferrer">Р¤РѕС‚Рѕ СЌРєСЂР°РЅР° Р±Р»РѕРєРёСЂРѕРІРєРё</a>
                      </Typography>
                    ) : null}
                    {appointment.payment_proof_url ? (
                      <Typography variant="body2">
                        <a href={appointment.payment_proof_url} target="_blank" rel="noreferrer">Р§РµРє/СЃРєСЂРёРЅ РѕРїР»Р°С‚С‹</a>
                      </Typography>
                    ) : null}
                  </Stack>
                )}
              </Paper>
            ) : null}

            {showMasterReviewAndPrice ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РџР°РЅРµР»СЊ РґРµР№СЃС‚РІРёР№ РјР°СЃС‚РµСЂР°</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Р¦РµРЅР° (СЂСѓР±.)"
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    helperText="РћР±С‹С‡РЅРѕ Р·Р°РЅРёРјР°РµС‚ 1-2 РјРёРЅСѓС‚С‹"
                  />
                  <Button variant="outlined" onClick={() => handlePrimaryAction("set_price")}>РЎРѕС…СЂР°РЅРёС‚СЊ С†РµРЅСѓ</Button>
                  <Button color="warning" variant="outlined" onClick={() => runAction(() => appointmentsApi.decline(id))}>
                    РћС‚РєР»РѕРЅРёС‚СЊ
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showMasterConfirmPayment ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РћРїР»Р°С‚Р° РєР»РёРµРЅС‚Р°</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  РџСЂРѕРІРµСЂСЊС‚Рµ С‡РµРє Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ РѕРїР»Р°С‚Сѓ. Р•СЃР»Рё РЅРµ РїРѕР»СѓС‡Р°РµС‚СЃСЏ вЂ” РЅР°РїРёС€РёС‚Рµ РєР»РёРµРЅС‚Сѓ РІ С‡Р°С‚.
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("confirm_payment")}>РџРѕРґС‚РІРµСЂРґРёС‚СЊ РѕРїР»Р°С‚Сѓ</Button>
              </Paper>
            ) : null}

            {showMasterStart ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Р—Р°РїСѓСЃРє СЂР°Р±РѕС‚С‹</Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("start_work")}>РќР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ</Button>
              </Paper>
            ) : null}

            {showMasterComplete ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>Р—Р°РІРµСЂС€РµРЅРёРµ</Typography>
                <Button variant="outlined" color="success" onClick={() => handlePrimaryAction("complete_work")}>Р—Р°РІРµСЂС€РёС‚СЊ СЂР°Р±РѕС‚Сѓ</Button>
              </Paper>
            ) : null}

            {showMasterTake ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РќРѕРІР°СЏ Р·Р°СЏРІРєР°</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Р§С‚Рѕ РґРµР»Р°С‚СЊ РґР°Р»СЊС€Рµ: РІРѕР·СЊРјРёС‚Рµ Р·Р°СЏРІРєСѓ, С‡С‚РѕР±С‹ Р·Р°РєСЂРµРїРёС‚СЊ РµРµ Р·Р° СЃРѕР±РѕР№.
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("take")}>Р’Р·СЏС‚СЊ Р·Р°СЏРІРєСѓ</Button>
              </Paper>
            ) : null}

            {showClientPaymentCard ? (
              <Paper
                ref={paymentRef}
                sx={{
                  p: { xs: 1.8, md: 2.2 },
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "warning.light",
                  background:
                    appointment.status === "AWAITING_PAYMENT"
                      ? "linear-gradient(155deg, #fffaf0 0%, #ffffff 100%)"
                      : "linear-gradient(155deg, #f5fbff 0%, #ffffff 100%)",
                  boxShadow: (theme) => `0 10px 28px ${theme.palette.warning.light}2d`,
                  transition: "box-shadow .24s ease, border-color .24s ease",
                  "&:hover": { boxShadow: "0 18px 34px rgba(15,23,42,0.12)" },
                }}
              >
                <Typography variant="h3" sx={{ mb: 0.7 }}>
                  {appointment.status === "AWAITING_PAYMENT" ? "РћРїР»Р°С‚Р° Рё С‡РµРє" : "Р§РµРє РѕС‚РїСЂР°РІР»РµРЅ РЅР° РїСЂРѕРІРµСЂРєСѓ"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {appointment.status === "AWAITING_PAYMENT"
                    ? "Р§С‚Рѕ РґРµР»Р°С‚СЊ РґР°Р»СЊС€Рµ: 1) РѕРїР»Р°С‚РёС‚Рµ 2) Р·Р°РіСЂСѓР·РёС‚Рµ С‡РµРє. РЎС‚Р°С‚СѓСЃ РѕРїР»Р°С‚С‹ РѕС‚РјРµС‚РёС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё."
                    : "РџСЂРѕРІРµСЂСЏРµРј С‡РµРє. РћР±С‹С‡РЅРѕ СЌС‚Рѕ Р·Р°РЅРёРјР°РµС‚ 1-5 РјРёРЅСѓС‚. Р•СЃР»Рё Р·Р°РґРµСЂР¶РєР° вЂ” РѕС‚РєСЂРѕР№С‚Рµ С‡Р°С‚ Рё РЅР°РїРёС€РёС‚Рµ РјР°СЃС‚РµСЂСѓ."}
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
                <Stepper activeStep={paymentFlowActiveStep} alternativeLabel sx={{ mb: 1.2 }}>
                  {paymentFlowLabels.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                {appointment.status === "PAYMENT_PROOF_UPLOADED" && paymentReviewMinutes != null ? (
                  <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ mb: 1 }}>
                    {paymentReviewMinutes < 1
                      ? "РџСЂРѕРІРµСЂРєР° С‡РµРєР° РЅР°С‡Р°Р»Р°СЃСЊ С‚РѕР»СЊРєРѕ С‡С‚Рѕ."
                      : `РџСЂРѕРІРµСЂРєР° С‡РµРєР° РёРґРµС‚ ${paymentReviewMinutes} РјРёРЅ.`}
                  </Alert>
                ) : null}

                <Stack spacing={0.4} sx={{ mb: 1 }}>
                  <Typography variant="body2"><b>Р‘Р°РЅРє:</b> {paymentSettings?.bank_requisites || "РЅРµ СѓРєР°Р·Р°РЅРѕ"}</Typography>
                  <Typography variant="body2"><b>РљСЂРёРїС‚РѕРІР°Р»СЋС‚Р°:</b> {paymentSettings?.crypto_requisites || "РЅРµ СѓРєР°Р·Р°РЅРѕ"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {paymentSettings?.instructions || "Р•СЃР»Рё РЅРµ РїРѕР»СѓС‡Р°РµС‚СЃСЏ вЂ” РЅР°РїРёС€РёС‚Рµ РІ С‡Р°С‚."}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                      onClick={() => copyToClipboard(paymentSettings?.bank_requisites)}
                    >
                      РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЂРµРєРІРёР·РёС‚С‹ Р±Р°РЅРєР°
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                      onClick={() => copyToClipboard(paymentSettings?.crypto_requisites)}
                    >
                      РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЂРµРєРІРёР·РёС‚С‹ РєСЂРёРїС‚Рѕ
                    </Button>
                  </Stack>
                </Stack>

                <Stack spacing={1}>
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
                        {appointment.status === "AWAITING_PAYMENT" ? "Выберите или перетащите файл чека" : "Загрузите новый чек"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Форматы: jpg, jpeg, png, pdf. Максимум 10 МБ.
                      </Typography>
                    </Stack>
                    <input hidden type="file" onChange={(event) => onSelectPaymentFile(event.target.files?.[0] || null)} />
                  </Box>
                  <Typography variant="body2">{paymentProofFile ? paymentProofFile.name : "Р¤Р°Р№Р» РЅРµ РІС‹Р±СЂР°РЅ"}</Typography>
                  {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

                  <TextField select label="РЎРїРѕСЃРѕР± РѕРїР»Р°С‚С‹" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
                    <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
                  </TextField>

                  <Button variant="contained" size="large" onClick={uploadPaymentProof} disabled={!canUploadPaymentProof}>
                    {uploadingProof ? "Р—Р°РіСЂСѓР¶Р°РµРј С‡РµРє..." : appointment.status === "AWAITING_PAYMENT" ? "Р—Р°РіСЂСѓР·РёС‚СЊ С‡РµРє Рё РїСЂРѕРґРѕР»Р¶РёС‚СЊ" : "РћС‚РїСЂР°РІРёС‚СЊ РЅРѕРІС‹Р№ С‡РµРє"}
                  </Button>

                  {appointment.status === "AWAITING_PAYMENT" ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        РџРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё СЃС‚Р°С‚СѓСЃ РѕР±С‹С‡РЅРѕ РјРµРЅСЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р·Р° 1-2 РјРёРЅСѓС‚С‹.
                      </Typography>
                      <Button size="small" variant="text" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
                        РќРµ РѕР±РЅРѕРІРёР»РѕСЃСЊ? РќР°Р¶Р°С‚СЊ В«РЇ РѕРїР»Р°С‚РёР»В»
                      </Button>
                    </Stack>
                  ) : (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="outlined" onClick={() => handlePrimaryAction("open_chat")}>
                        РћС‚РєСЂС‹С‚СЊ С‡Р°С‚
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
                    <Typography variant="h3">Р‘С‹СЃС‚СЂС‹Р№ СЃРёРіРЅР°Р» РјР°СЃС‚РµСЂСѓ</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    РћРґРёРЅ РєР»РёРє, С‡С‚РѕР±С‹ РјР°СЃС‚РµСЂ РїРѕРЅСЏР» РІР°С€ С‚РµРєСѓС‰РёР№ РєРѕРЅС‚РµРєСЃС‚. Р­С‚Рѕ СѓСЃРєРѕСЂСЏРµС‚ РѕС‚РІРµС‚ Рё СЃРЅРёР¶Р°РµС‚ РїР°СѓР·С‹.
                  </Typography>

                  <TextField
                    select
                    label="Р§С‚Рѕ СЃРµР№С‡Р°СЃ РІР°Р¶РЅРѕ"
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
                    label="РљРѕРјРјРµРЅС‚Р°СЂРёР№ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)"
                    placeholder="РќР°РїСЂРёРјРµСЂ: РєРѕРґ РѕС€РёР±РєРё, СѓРґРѕР±РЅРѕРµ РІСЂРµРјСЏ, С‡С‚Рѕ СѓР¶Рµ РїРѕРїСЂРѕР±РѕРІР°Р»Рё"
                    multiline
                    minRows={2}
                    value={clientSignalComment}
                    onChange={(event) => setClientSignalComment(event.target.value)}
                  />

                  <Button variant="outlined" onClick={sendClientSignal}>
                    РћС‚РїСЂР°РІРёС‚СЊ СЃРёРіРЅР°Р»
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showClientRepeat && (!showClientTabs || clientTab === "details") ? (
              <Paper sx={{ p: 2.2 }}>
                <Stack spacing={1}>
                  <Typography variant="h3">РќСѓР¶РЅР° РїРѕС…РѕР¶Р°СЏ Р·Р°СЏРІРєР°?</Typography>
                  <Typography variant="body2" color="text.secondary">
                    РЎРѕР·РґР°РґРёРј РЅРѕРІСѓСЋ Р·Р°СЏРІРєСѓ СЃ С‚РµРјРё Р¶Рµ РїР°СЂР°РјРµС‚СЂР°РјРё СѓСЃС‚СЂРѕР№СЃС‚РІР°. РћСЃС‚Р°РЅРµС‚СЃСЏ С‚РѕР»СЊРєРѕ СѓС‚РѕС‡РЅРёС‚СЊ РґРµС‚Р°Р»Рё.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<ReplayRoundedIcon />}
                    onClick={repeatAppointment}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    РџРѕРІС‚РѕСЂРёС‚СЊ Р·Р°СЏРІРєСѓ
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showAdminControls ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РЈРїСЂР°РІР»РµРЅРёРµ Р·Р°СЏРІРєРѕР№ (Р°РґРјРёРЅ)</Typography>
                <Stack spacing={1}>
                  {showAdminPaymentConfirm ? (
                    <Button variant="outlined" onClick={() => handlePrimaryAction("confirm_payment_admin")}>
                      РџРѕРґС‚РІРµСЂРґРёС‚СЊ РѕРїР»Р°С‚Сѓ
                    </Button>
                  ) : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField select label="РЎРјРµРЅРёС‚СЊ СЃС‚Р°С‚СѓСЃ" value={manualStatus} onChange={(event) => setManualStatus(event.target.value)}>
                      {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>
                      ))}
                    </TextField>
                    <TextField label="РљРѕРјРјРµРЅС‚Р°СЂРёР№" value={manualNote} onChange={(event) => setManualNote(event.target.value)} />
                    <Button variant="outlined" onClick={() => runAction(() => adminApi.setStatus(id, { status: manualStatus, note: manualNote }))}>
                      РџСЂРёРјРµРЅРёС‚СЊ
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ) : null}

            {showClientReview && (!showClientTabs || clientTab === "details") ? (
              <Paper ref={reviewRef} sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РћС†РµРЅРёС‚Рµ СЂР°Р±РѕС‚Сѓ РјР°СЃС‚РµСЂР°</Typography>
                <Stack spacing={1}>
                  <TextField type="number" label="Р РµР№С‚РёРЅРі 1-5" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} />
                  <TextField label="РљРѕРјРјРµРЅС‚Р°СЂРёР№" multiline minRows={2} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
                  <Button variant="outlined" onClick={() => runAction(() => reviewsApi.reviewMaster(id, { rating: reviewRating, comment: reviewComment }))}>
                    РћС‚РїСЂР°РІРёС‚СЊ РѕС‚Р·С‹РІ
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showMasterReviewClient ? (
              <Paper ref={reviewRef} sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>РћС†РµРЅРєР° РєР»РёРµРЅС‚Р°</Typography>
                <Stack spacing={1}>
                  <TextField type="number" label="Р РµР№С‚РёРЅРі 1-5" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} />
                  <TextField
                    select
                    label="Р¤Р»Р°РіРё РїРѕРІРµРґРµРЅРёСЏ"
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
                  <TextField label="РљРѕРјРјРµРЅС‚Р°СЂРёР№" multiline minRows={2} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
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
                    РЎРѕС…СЂР°РЅРёС‚СЊ РѕС†РµРЅРєСѓ РєР»РёРµРЅС‚Р°
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showClientChatPanel ? (
              <Box ref={chatRef}>
                <ChatPanel appointmentId={id} currentUser={user} systemEvents={mappedSystemEvents} />
              </Box>
            ) : null}

            {showClientDetailsCard ? (
              <Box ref={timelineRef}>
                <Accordion
                  disableGutters
                  sx={{
                    borderRadius: 3,
                    border: "1px solid rgba(15,23,42,0.08)",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Stack spacing={0.25}>
                      <Typography variant="h3">РџРѕРґСЂРѕР±РЅРµРµ РїРѕ Р·Р°РєР°Р·Сѓ</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Р”РѕРІРµСЂРёРµ, СЃСЂРѕРєРё Рё РїРѕСЃР»РµРґРЅРёРµ СЃРѕР±С‹С‚РёСЏ
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.2}>
                      <Typography variant="body2"><b>РњР°СЃС‚РµСЂ:</b> {appointment.master_username || "РџРѕРєР° РЅРµ РЅР°Р·РЅР°С‡РµРЅ"}</Typography>
                      <Typography variant="body2"><b>SLA РѕС‚РІРµС‚ РґРѕ:</b> {appointment.response_deadline_at ? dayjs(appointment.response_deadline_at).format("DD.MM.YYYY HH:mm") : "вЂ”"}</Typography>
                      <Typography variant="body2"><b>SLA Р·Р°РІРµСЂС€РµРЅРёРµ РґРѕ:</b> {appointment.completion_deadline_at ? dayjs(appointment.completion_deadline_at).format("DD.MM.YYYY HH:mm") : "вЂ”"}</Typography>
                      {appointment.sla_breached ? (
                        <Alert severity="warning" sx={{ py: 0 }}>
                          РњС‹ СѓР¶Рµ РїРѕРґРєР»СЋС‡РёР»Рё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°, С‡С‚РѕР±С‹ СѓСЃРєРѕСЂРёС‚СЊ РїСЂРѕС†РµСЃСЃ.
                        </Alert>
                      ) : null}
                      <Divider />
                      <Typography variant="subtitle2">РџРѕСЃР»РµРґРЅРёРµ СЃРѕР±С‹С‚РёСЏ</Typography>
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
                        <Typography variant="body2" color="text.secondary">РЎРѕР±С‹С‚РёР№ РїРѕРєР° РЅРµС‚.</Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Box>
            ) : null}
          </Stack>
        </Grid>

        {!isClient ? (
          <Grid item xs={12} lg={4}>
            <Stack spacing={2}>
              <Paper sx={{ p: 2.2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ShieldRoundedIcon color="primary" fontSize="small" />
                <Typography variant="h3">Р”РѕРІРµСЂРёРµ Рё РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ</Typography>
              </Stack>

              <Stack spacing={0.7}>
                <Typography variant="body2"><b>РњР°СЃС‚РµСЂ:</b> {appointment.master_username || "РџРѕРєР° РЅРµ РЅР°Р·РЅР°С‡РµРЅ"}</Typography>
                {user.role !== "client" ? (
                  <Typography variant="body2"><b>Р РёСЃРє РєР»РёРµРЅС‚Р°:</b> {appointment.client_risk_level || "вЂ”"} {appointment.client_risk_score != null ? `(${appointment.client_risk_score})` : ""}</Typography>
                ) : null}
                <Typography variant="body2"><b>SLA РѕС‚РІРµС‚ РґРѕ:</b> {appointment.response_deadline_at ? dayjs(appointment.response_deadline_at).format("DD.MM.YYYY HH:mm") : "вЂ”"}</Typography>
                <Typography variant="body2"><b>SLA Р·Р°РІРµСЂС€РµРЅРёРµ РґРѕ:</b> {appointment.completion_deadline_at ? dayjs(appointment.completion_deadline_at).format("DD.MM.YYYY HH:mm") : "вЂ”"}</Typography>
                {["NEW", "IN_REVIEW"].includes(appointment.status) && responseEtaMinutes != null ? (
                  <Alert severity={responseEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
                    РћР¶РёРґР°РµРј РѕС‚РІРµС‚ РјР°СЃС‚РµСЂР°: {formatEtaMinutes(responseEtaMinutes)}
                  </Alert>
                ) : null}
                {["PAID", "IN_PROGRESS"].includes(appointment.status) && completionEtaMinutes != null ? (
                  <Alert severity={completionEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
                    РџСЂРѕРіРЅРѕР· РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ: {formatEtaMinutes(completionEtaMinutes)}
                  </Alert>
                ) : null}
                {appointment.sla_breached ? (
                  <Alert severity="warning">SLA РЅР°СЂСѓС€РµРЅ. РњС‹ СѓР¶Рµ СѓРІРµРґРѕРјРёР»Рё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.</Alert>
                ) : null}

                {!isClient ? (
                  <>
                    <Divider sx={{ my: 0.7 }} />
                    <Typography variant="caption">Р§С‚Рѕ РґРµР»Р°С‚СЊ РґР°Р»СЊС€Рµ: РѕСЂРёРµРЅС‚РёСЂСѓР№С‚РµСЃСЊ РЅР° С€Р°РіРё СЃРІРµСЂС…Сѓ Рё РёСЃРїРѕР»СЊР·СѓР№С‚Рµ С‡Р°С‚ РґР»СЏ РІСЃРµС… СѓС‚РѕС‡РЅРµРЅРёР№.</Typography>
                    <Typography variant="caption">РћР±С‹С‡РЅРѕ РЅР°Р·РЅР°С‡РµРЅРёРµ РјР°СЃС‚РµСЂР° Р·Р°РЅРёРјР°РµС‚ 5-15 РјРёРЅСѓС‚.</Typography>
                    <Typography variant="caption">Р•СЃР»Рё РЅРµ РїРѕР»СѓС‡Р°РµС‚СЃСЏ вЂ” РЅР°РїРёС€РёС‚Рµ РІ С‡Р°С‚, РјС‹ РїРѕРґРєР»СЋС‡РёРјСЃСЏ.</Typography>
                  </>
                ) : null}
              </Stack>
            </Paper>

              <Paper ref={timelineRef} sx={{ p: 2.2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <TimelineRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="h3">Р›РµРЅС‚Р° СЃРѕР±С‹С‚РёР№</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  РћР±РЅРѕРІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РєР°Р¶РґС‹Рµ 3-4 СЃРµРєСѓРЅРґС‹
                </Typography>

                {visibleTimelineEvents.length ? (
                  <Stack spacing={1}>
                    {visibleTimelineEvents.map((event, index) => (
                      <Stack key={event.id} spacing={0.35}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{getEventTitle(event)}</Typography>
                        {event.note ? <Typography variant="caption" color="text.secondary">{event.note}</Typography> : null}
                        <Typography variant="caption" color="text.secondary">
                          {event.actor_username || "РЎРёСЃС‚РµРјР°"} вЂў {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                        </Typography>
                        {index < visibleTimelineEvents.length - 1 ? <Divider /> : null}
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">РЎРѕР±С‹С‚РёСЏ РїРѕРєР° РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚.</Typography>
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
              {["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? "РћРїР»Р°С‚Р°" : "РџРѕРјРѕС‰СЊ"}
            </Button>
            <Button fullWidth size="small" variant="text" onClick={() => handlePrimaryAction("open_chat")}>
              Р§Р°С‚
            </Button>
            <Button fullWidth size="small" variant="text" onClick={() => handlePrimaryAction("open_timeline")}>
              РЎС‚Р°С‚СѓСЃ
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
              {appointment.status === "AWAITING_PAYMENT" ? "РћРїР»Р°С‚Р° РѕР¶РёРґР°РµС‚ РІР°С€РµРіРѕ РґРµР№СЃС‚РІРёСЏ" : "Р§РµРє РѕС‚РїСЂР°РІР»РµРЅ РЅР° РїСЂРѕРІРµСЂРєСѓ"}
            </Typography>
            <LinearProgress variant="determinate" value={paymentProgressValue} sx={{ borderRadius: 999, height: 8 }} />
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="1) РћРїР»Р°С‚Р°"
                color={appointment.status === "AWAITING_PAYMENT" ? "warning" : "success"}
                variant={appointment.status === "AWAITING_PAYMENT" ? "filled" : "outlined"}
              />
              <Chip
                size="small"
                label="2) Р§РµРє"
                color={paymentFlowStatusesDone.includes(appointment.status) ? "success" : "default"}
                variant={paymentFlowStatusesDone.includes(appointment.status) ? "outlined" : "filled"}
              />
              <Chip
                size="small"
                label="3) РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ"
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
                ? "РЎРЅР°С‡Р°Р»Р° РѕРїР»Р°С‚РёС‚Рµ Рё Р·Р°РіСЂСѓР·РёС‚Рµ С‡РµРє. РЎС‚Р°С‚СѓСЃ РѕРїР»Р°С‚С‹ РѕС‚РјРµС‡Р°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, РѕР±С‹С‡РЅРѕ Р·Р° 1-2 РјРёРЅСѓС‚С‹."
                : "РџРѕРєР° РёРґРµС‚ РїСЂРѕРІРµСЂРєР°, РґРµСЂР¶РёС‚Рµ РѕС‚РєСЂС‹С‚С‹Рј С‡Р°С‚. Р•СЃР»Рё РѕС‚РІРµС‚Р° РЅРµС‚ 5 РјРёРЅСѓС‚ вЂ” РЅР°РїРёС€РёС‚Рµ РјР°СЃС‚РµСЂСѓ."}
            </Typography>
            {appointment.status === "PAYMENT_PROOF_UPLOADED" && paymentReviewMinutes != null ? (
              <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ py: 0 }}>
                {paymentReviewMinutes < 1
                  ? "РџСЂРѕРІРµСЂРєР° С‡РµРєР° РЅР°С‡Р°Р»Р°СЃСЊ С‚РѕР»СЊРєРѕ С‡С‚Рѕ."
                  : `РџСЂРѕРІРµСЂРєР° С‡РµРєР° РёРґРµС‚ ${paymentReviewMinutes} РјРёРЅ.`}
                {paymentReviewMinutes >= 10 ? " Р•СЃР»Рё Р·Р°С‚СЏРЅСѓР»РѕСЃСЊ вЂ” РѕС‚РєСЂРѕР№С‚Рµ С‡Р°С‚ Рё РЅР°РїРёС€РёС‚Рµ РјР°СЃС‚РµСЂСѓ." : ""}
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
                {appointment.status === "AWAITING_PAYMENT" ? "РџРµСЂРµР№С‚Рё Рє РѕРїР»Р°С‚Рµ" : "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚"}
              </Button>
              <Button fullWidth variant="outlined" onClick={() => handlePrimaryAction("open_timeline")}>
                Р›РµРЅС‚Р°
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
              background: "linear-gradient(160deg, rgba(255,255,255,0.99) 0%, rgba(246,251,255,0.98) 100%)",
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
            border: "1px solid rgba(15,23,42,0.08)",
            background: "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(246,251,255,0.96) 100%)",
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
            border: "1px solid rgba(15,23,42,0.08)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(243,249,255,0.94) 100%)",
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
            border: "1px solid rgba(16,185,129,0.25)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.98) 100%)",
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

