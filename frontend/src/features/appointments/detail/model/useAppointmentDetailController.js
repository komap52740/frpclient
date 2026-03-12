import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { appointmentsApi, chatApi } from "../../../../api/client";
import { getStatusLabel } from "../../../../constants/labels";
import { normalizeRuText } from "../../../../utils/text";
import {
  CLIENT_SIGNAL_OPTIONS,
  areEventListsEqual,
  buildFallbackEvents,
  dedupeEvents,
  getAppointmentSnapshot,
  getEventTitle,
  resolveClientActionByStatus,
  resolvePaymentUploadError,
  validatePaymentFile,
  validatePaymentRequisitesNote,
} from "./appointmentDetailUtils";
import {
  useAppointmentDetailQuery,
  useAppointmentEventsQuery,
} from "./useAppointmentDetailQueries";
import { useAppointmentLiveSync } from "./useAppointmentLiveSync";

dayjs.locale("ru");

const RU_DESKTOP_DOWNLOAD_URL = "https://rudesktop.ru/downloads/";

export function useAppointmentDetailController({ id, isMobile, navigate, searchParams, user }) {
  const [appointment, setAppointment] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentRequisitesNote, setPaymentRequisitesNote] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentFileError, setPaymentFileError] = useState("");
  const [paymentRequisitesError, setPaymentRequisitesError] = useState("");

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [clientReviewFlags, setClientReviewFlags] = useState([]);

  const [manualStatus, setManualStatus] = useState("NEW");
  const [manualNote, setManualNote] = useState("");
  const [clientSignal, setClientSignal] = useState("need_help");
  const [clientSignalComment, setClientSignalComment] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentUploadProgress, setPaymentUploadProgress] = useState(0);
  const [paymentUploadFailed, setPaymentUploadFailed] = useState(false);
  const [paymentUploadedDialogOpen, setPaymentUploadedDialogOpen] = useState(false);
  const [paymentGuideOpen, setPaymentGuideOpen] = useState(false);
  const [paymentFocusOpen, setPaymentFocusOpen] = useState(false);
  const [paymentDragOver, setPaymentDragOver] = useState(false);
  const [clientTab, setClientTab] = useState("chat");
  const [chatPanelView, setChatPanelView] = useState("messages");
  const [clientAccessDialogOpen, setClientAccessDialogOpen] = useState(false);
  const [clientAccessSaving, setClientAccessSaving] = useState(false);
  const [clientAccessForm, setClientAccessForm] = useState({
    rustdesk_id: "",
    rustdesk_password: "",
  });
  const [clientDataExpanded, setClientDataExpanded] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    severity: "success",
    message: "",
    actionKey: "",
  });
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
  const lastKnownStatusRef = useRef(null);
  const lastDetailSnapshotRef = useRef("");
  const { refetch: refetchAppointmentDetail } = useAppointmentDetailQuery(id, { enabled: false });
  const { refetch: refetchAppointmentEvents } = useAppointmentEventsQuery(
    id,
    {},
    { enabled: false }
  );

  const loadDetail = useCallback(
    async ({ preserveDrafts = false, silent = false } = {}) => {
      try {
        const appointmentResponse = await refetchAppointmentDetail();
        const nextDetail = appointmentResponse.data || null;
        const nextStatus = nextDetail?.status || null;
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

        const nextSnapshot = getAppointmentSnapshot(nextDetail);
        const changed = nextSnapshot !== lastDetailSnapshotRef.current;
        if (changed) {
          lastDetailSnapshotRef.current = nextSnapshot;
          setAppointment(nextDetail);
        }

        if (!preserveDrafts && nextDetail) {
          setPrice(nextDetail.total_price || "");
          setManualStatus(nextDetail.status);
          setPaymentRequisitesNote(nextDetail.payment_requisites_note || "");
          setPaymentRequisitesError("");
        }

        setError("");
      } catch {
        if (!silent) {
          setError("Не удалось загрузить заявку");
        }
      }
    },
    [refetchAppointmentDetail]
  );

  const loadEvents = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const response = await refetchAppointmentEvents();
        const incoming = response.data || [];
        const normalized = dedupeEvents(incoming).sort(
          (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
        );
        setEvents((prev) => (areEventListsEqual(prev, normalized) ? prev : normalized));
      } catch {
        if (!silent) {
          setError("Не удалось загрузить ленту событий");
        }
      }
    },
    [refetchAppointmentEvents]
  );

  const loadData = useCallback(
    async ({ preserveDrafts = false, silent = false } = {}) => {
      await Promise.all([loadDetail({ preserveDrafts, silent }), loadEvents({ silent })]);
    },
    [loadDetail, loadEvents]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRealtimeEvent = useCallback(
    (payload) => {
      if (payload?.kind !== "platform_event") {
        return;
      }

      const eventType = String(payload?.event?.event_type || "");
      const shouldRefreshDetail =
        eventType.startsWith("appointment.") || eventType.startsWith("sla.");
      const shouldRefreshEvents =
        eventType.startsWith("appointment.") || eventType === "chat.message_deleted";

      if (!shouldRefreshDetail && !shouldRefreshEvents) {
        return;
      }

      loadData({ preserveDrafts: true, silent: true }).catch(() => undefined);
    },
    [loadData]
  );

  useAppointmentLiveSync({
    appointmentId: id,
    enabled: Boolean(id),
    onConnected: () => {
      loadData({ preserveDrafts: true, silent: true }).catch(() => undefined);
    },
    onAppointmentEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) {
      return;
    }

    if (user?.role === "client") {
      if (
        focus === "payment" &&
        ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment?.status)
      ) {
        setClientTab("payment");
      } else if (focus === "timeline" || focus === "review") {
        setClientTab(clientCompactView ? "chat" : "details");
      } else if (focus === "chat") {
        setChatPanelView("messages");
        setClientTab("chat");
      } else if (focus === "links") {
        setChatPanelView("links");
        setClientTab("chat");
      }
    }

    const byFocus = {
      payment: paymentRef,
      chat: chatRef,
      links: chatRef,
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
    setChatPanelView("messages");
    setClientDataExpanded(false);
  }, [appointment?.id, user?.role]);

  useEffect(() => {
    if (!appointment || user?.role !== "client") {
      return;
    }
    setClientAccessForm({
      rustdesk_id: appointment.rustdesk_id || "",
      rustdesk_password: appointment.rustdesk_password || "",
    });
  }, [appointment?.id, appointment?.rustdesk_id, appointment?.rustdesk_password, user?.role]);

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
      return ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment?.status)
        ? "payment"
        : "chat";
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
    if (user?.role !== "client") {
      return normalized;
    }
    return [];
  }, [timelineEvents, user?.role]);

  const runAction = async (action) => {
    try {
      await action();
      await loadData({ preserveDrafts: true, silent: true });
      setSuccess("Действие выполнено");
      setError("");
      setToast({ open: true, severity: "success", message: "Действие выполнено" });
      return true;
    } catch (err) {
      const rawDetail = err.response?.data?.detail || "Ошибка выполнения действия";
      const detailMessage = normalizeRuText(rawDetail);
      setSuccess("");
      setError(detailMessage);
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

  const requestClientPasswordCheck = async () => {
    const ok = await runAction(async () => {
      const formData = new FormData();
      formData.append(
        "text",
        "Пожалуйста, проверьте пароль RuDesktop. Если пароль изменился, отправьте новый пароль в чат."
      );
      await chatApi.sendMessage(id, formData);
    });
    if (ok) {
      setSuccess("Запрос отправлен клиенту");
      setChatPanelView("messages");
    }
  };

  const persistClientAccessData = async (payload, options = {}) => {
    const normalizedPayload = {
      rustdesk_id: (payload?.rustdesk_id || "").trim(),
      rustdesk_password: (payload?.rustdesk_password || "").trim(),
    };
    const closeDialog = Boolean(options?.closeDialog);

    if (!normalizedPayload.rustdesk_id && !normalizedPayload.rustdesk_password) {
      throw new Error("Укажите логин/ID и/или пароль RuDesktop");
    }

    try {
      setClientAccessSaving(true);
      await appointmentsApi.updateClientAccess(id, normalizedPayload);
      await loadData({ preserveDrafts: true, silent: true });
      if (closeDialog) {
        setClientAccessDialogOpen(false);
      }
      setSuccess("Данные RuDesktop сохранены");
      setToast({ open: true, severity: "success", message: "Данные RuDesktop сохранены" });
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || "Не удалось сохранить данные RuDesktop";
      setError(detail);
      setToast({ open: true, severity: "error", message: detail });
      throw err;
    } finally {
      setClientAccessSaving(false);
    }
  };

  const saveClientAccessData = async () => {
    try {
      await persistClientAccessData(clientAccessForm, { closeDialog: true });
    } catch (err) {
      if (err?.message && !err?.response) {
        setError(err.message);
      }
    }
  };

  const saveClientAccessInline = async (payload) => {
    try {
      await persistClientAccessData(payload, { closeDialog: false });
    } catch (err) {
      if (err?.message && !err?.response) {
        setError(err.message);
      }
      throw err;
    }
  };

  const openRuDesktopSession = async (remoteId, remotePassword = "") => {
    const preparedId = String(remoteId || "").trim();
    const preparedPassword = String(remotePassword || "").trim();
    if (!preparedId) {
      setError("Логин/ID RuDesktop не указан");
      return;
    }

    try {
      if (preparedPassword) {
        await navigator.clipboard.writeText(preparedPassword);
        setSuccess("Запускаем RuDesktop. В буфер скопирован только пароль.");
      } else {
        await navigator.clipboard.writeText(preparedId);
        setSuccess("Запускаем RuDesktop. Пароль не задан, в буфер скопирован логин/ID.");
      }
    } catch {
      setSuccess("Запускаем RuDesktop. Если не откроется — скопируйте данные вручную из карточки.");
    }

    const encodedId = encodeURIComponent(preparedId);
    const encodedPassword = encodeURIComponent(preparedPassword);
    const uriCandidates = preparedPassword
      ? [
          `rudesktop://${encodedId}?password=${encodedPassword}`,
          `rudesktop://${encodedId}`,
          `rustdesk://${encodedId}?password=${encodedPassword}`,
          `rustdesk://${encodedId}`,
        ]
      : [`rudesktop://${encodedId}`, `rustdesk://${encodedId}`];

    const [primaryUri, ...fallbackUris] = uriCandidates;
    window.location.href = primaryUri;
    fallbackUris.forEach((uri, index) => {
      window.setTimeout(
        () => {
          if (!document.hidden) {
            window.location.href = uri;
          }
        },
        550 * (index + 1)
      );
    });

    window.setTimeout(
      () => {
        if (!document.hidden) {
          window.open(RU_DESKTOP_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
          setError(
            "Не удалось открыть RuDesktop автоматически. Установите/переустановите клиент и попробуйте снова."
          );
        }
      },
      550 * (fallbackUris.length + 1) + 700
    );
  };

  const onSelectPaymentFile = (selected) => {
    setPaymentDragOver(false);
    setPaymentProofFile(selected);
    setPaymentUploadFailed(false);
    setPaymentUploadProgress(0);
    setPaymentFileError(selected ? validatePaymentFile(selected) : "");
    if (selected) {
      setError("");
    }
    if (!selected && paymentFileInputRef.current) {
      paymentFileInputRef.current.value = "";
    }
  };

  const onPaymentRequisitesChange = (event) => {
    const nextValue = event.target.value;
    setPaymentRequisitesNote(nextValue);
    if (paymentRequisitesError) {
      setPaymentRequisitesError(validatePaymentRequisitesNote(nextValue));
    }
  };

  const markPaidManually = async () => {
    const noteError = validatePaymentRequisitesNote(paymentRequisitesNote);
    setPaymentRequisitesError(noteError);
    if (noteError) {
      setError(noteError);
      setToast({ open: true, severity: "warning", message: noteError });
      return;
    }
    await runAction(() =>
      appointmentsApi.markPaid(id, paymentMethod, (paymentRequisitesNote || "").trim())
    );
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
    setPaymentUploadProgress(0);
    setPaymentUploadFailed(false);

    try {
      await appointmentsApi.uploadPaymentProof(id, formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent?.total || 0;
          const loaded = progressEvent?.loaded || 0;
          if (total > 0) {
            const nextProgress = Math.max(1, Math.min(100, Math.round((loaded / total) * 100)));
            setPaymentUploadProgress(nextProgress);
          }
        },
      });

      setPaymentUploadProgress(100);

      let autoMarkedPaid = false;
      const requisitesError = validatePaymentRequisitesNote(paymentRequisitesNote);
      setPaymentRequisitesError(requisitesError);

      if (appointment?.status === "AWAITING_PAYMENT" && !requisitesError) {
        try {
          await appointmentsApi.markPaid(id, paymentMethod, (paymentRequisitesNote || "").trim());
          autoMarkedPaid = true;
        } catch (markError) {
          const markDetail = normalizeRuText(
            markError?.response?.data?.detail ||
              "Чек загружен. Нажмите «Я оплатил», если статус не изменился автоматически."
          );
          setToast({
            open: true,
            severity: "warning",
            message: markDetail,
          });
        }
      } else if (appointment?.status === "AWAITING_PAYMENT" && requisitesError) {
        setToast({
          open: true,
          severity: "warning",
          message: "Чек загружен. Укажите реквизиты оплаты и нажмите «Я оплатил».",
        });
      }

      await loadData({ preserveDrafts: true, silent: true });
      setSuccess(autoMarkedPaid ? "Чек загружен, оплата отмечена." : "Чек загружен.");
      setError("");
      setPaymentProofFile(null);
      setPaymentFileError("");
      setPaymentUploadFailed(false);
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
      const detail = resolvePaymentUploadError(err);
      setError(detail);
      setPaymentUploadFailed(true);
      setToast({ open: true, severity: "error", message: detail });
    } finally {
      setUploadingProof(false);
    }
  };

  return {
    appointment,
    chatPanelView,
    clientAccessDialogOpen,
    clientAccessForm,
    clientAccessSaving,
    clientCompactView,
    clientDataExpanded,
    clientReviewFlags,
    clientSignal,
    clientSignalComment,
    clientTab,
    error,
    manualNote,
    manualStatus,
    markPaidManually,
    mappedSystemEvents,
    onPaymentDrop,
    onPaymentRequisitesChange,
    onSelectPaymentFile,
    openRuDesktopSession,
    paymentDragOver,
    paymentFileError,
    paymentFileInputRef,
    paymentFocusOpen,
    paymentGuideOpen,
    paymentMethod,
    paymentProofFile,
    paymentRef,
    paymentRequisitesError,
    paymentRequisitesNote,
    paymentUploadFailed,
    paymentUploadedDialogOpen,
    paymentUploadProgress,
    price,
    repeatAppointment,
    requestClientPasswordCheck,
    reviewComment,
    reviewRating,
    reviewRef,
    runAction,
    saveClientAccessData,
    saveClientAccessInline,
    sendClientSignal,
    setChatPanelView,
    setClientAccessDialogOpen,
    setClientAccessForm,
    setClientCompactView,
    setClientDataExpanded,
    setClientReviewFlags,
    setClientSignal,
    setClientSignalComment,
    setClientTab,
    setError,
    setManualNote,
    setManualStatus,
    setPaymentDragOver,
    setPaymentFocusOpen,
    setPaymentGuideOpen,
    setPaymentMethod,
    setPaymentUploadedDialogOpen,
    setPrice,
    setReviewComment,
    setReviewRating,
    setToast,
    success,
    timelineEvents,
    timelineRef,
    toast,
    triggerPaymentFilePicker,
    uploadingProof,
    uploadPaymentProof,
    chatRef,
    copyToClipboard,
  };
}
