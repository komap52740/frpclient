import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
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
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { adminApi, appointmentsApi, reviewsApi } from "../api/client";
import ChatPanel from "../components/ChatPanel";
import PrimaryCTA from "../components/ui/PrimaryCTA";
import AppointmentDetailSkeleton from "../components/ui/skeletons/AppointmentDetailSkeleton";
import StatusStepper from "../components/ui/StatusStepper";
import { getLockTypeLabel } from "../constants/labels";
import {
  behaviorFlags,
  formatEtaMinutes,
  getEventTitle,
} from "../features/appointments/detail/model/appointmentDetailUtils";
import { useAppointmentDetailController } from "../features/appointments/detail/model/useAppointmentDetailController";
import AppointmentClientDetailsAccordion from "../features/appointments/detail/ui/AppointmentClientDetailsAccordion";
import {
  AppointmentClientPaymentCard,
  ClientAccessDialog,
  PaymentFocusOverlay,
  PaymentGuideDialog,
  PaymentUploadedDialog,
} from "../features/appointments/detail/ui/AppointmentPaymentPanels";
import {
  ClientReviewCard,
  MasterReviewClientCard,
} from "../features/appointments/detail/ui/AppointmentReviewPanels";
import {
  AppointmentLinksSidebar,
  AppointmentTimelineSidebar,
  AppointmentTrustSidebar,
} from "../features/appointments/detail/ui/AppointmentSidebarPanels";
import {
  AppointmentAdminControlsPanel,
  AppointmentClientFloatingActionBar,
  AppointmentClientPaymentDock,
  AppointmentClientSignalPanel,
  AppointmentRepeatPanel,
} from "../features/appointments/detail/ui/AppointmentUtilityPanels";
import { useAuth } from "../features/auth/hooks/useAuth";
import { resolveStatusUI } from "../theme/status";
import { normalizeRuText } from "../utils/text";

dayjs.locale("ru");

const RU_DESKTOP_DOWNLOAD_URL = "https://rudesktop.ru/downloads/";
const RU_DESKTOP_HELP_URL = "https://rudesktop.ru/";

export default function AppointmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, paymentSettings } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";
  const isClient = user?.role === "client";
  const {
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
    copyToClipboard,
    error,
    manualNote,
    manualStatus,
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
    markPaidManually,
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
  } = useAppointmentDetailController({
    id,
    isMobile,
    navigate,
    searchParams,
    user,
  });

  if (!appointment) {
    return <AppointmentDetailSkeleton />;
  }

  const isClientStrictLayout = isClient;
  const isClientMinimal = isClient && clientCompactView;
  const isMasterAssigned = user.role === "master" && appointment.assigned_master === user.id;

  const showClientPaymentActions =
    user.role === "client" &&
    ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status);
  const showClientReview = user.role === "client" && appointment.status === "COMPLETED";
  const showClientSignals = false;
  const showClientRepeat =
    user.role === "client" &&
    ["COMPLETED", "CANCELLED", "DECLINED_BY_MASTER"].includes(appointment.status);
  const showClientTabs = isClientStrictLayout
    ? true
    : user.role === "client" &&
      !isClientMinimal &&
      (!clientCompactView || showClientPaymentActions);

  const showMasterTake = user.role === "master" && appointment.status === "NEW";
  const showMasterReviewAndPrice = isMasterAssigned && appointment.status === "IN_REVIEW";
  const showMasterConfirmPayment =
    isMasterAssigned && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showMasterStart = isMasterAssigned && appointment.status === "PAID";
  const showMasterComplete = isMasterAssigned && appointment.status === "IN_PROGRESS";
  const showMasterReviewClient = isMasterAssigned && appointment.status === "COMPLETED";
  const showMasterActionPanel =
    user.role === "master" &&
    (showMasterTake ||
      showMasterReviewAndPrice ||
      showMasterConfirmPayment ||
      showMasterStart ||
      showMasterComplete);
  const showLegacyMasterCards = false;

  const showAdminControls = user.role === "admin";
  const showAdminPaymentConfirm =
    showAdminControls && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showClientPaymentHighlight = isClientStrictLayout
    ? false
    : isClient && showClientPaymentActions;
  const isClientCompact = isClientStrictLayout ? false : isClient && clientCompactView;
  const clientDetailsTabEnabled = isClientStrictLayout ? false : !isClientCompact;
  const showClientDesktopSidebar = false;
  const showClientPaymentDock = isClientStrictLayout
    ? false
    : isClient && !isMobile && showClientPaymentActions;
  const showClientFloatingActionBar = isClientStrictLayout
    ? false
    : isClient && isMobile && showClientPaymentActions;
  const showClientQuickRail = false;
  const clientPaymentTabDisabled = !showClientPaymentActions;
  const showClientDataCard = isClient
    ? false
    : !showClientTabs || (clientTab === "details" && clientDetailsTabEnabled);
  const showClientPaymentCard = isClientStrictLayout
    ? showClientPaymentActions && clientTab === "payment"
    : showClientPaymentActions && !isClientMinimal && (!showClientTabs || clientTab === "payment");
  const showClientChatPanel = isClientStrictLayout
    ? clientTab === "chat"
    : !showClientTabs || clientTab === "chat";
  const showClientDetailsCard = isClientStrictLayout
    ? false
    : !isClientMinimal && showClientTabs && clientTab === "details" && clientDetailsTabEnabled;
  const showClientSecondaryCards = isClient
    ? false
    : !isClientMinimal && !isClientCompact && (!showClientTabs || clientTab === "details");
  const showClientReviewCard =
    showClientReview && (isClientStrictLayout ? clientTab === "details" : showClientSecondaryCards);
  const paymentConfirmedStatuses = ["PAID", "IN_PROGRESS", "COMPLETED"];
  const latestPaymentProofEvent = timelineEvents.find(
    (event) => event.event_type === "payment_proof_uploaded"
  );
  const paymentReviewStartedAt =
    latestPaymentProofEvent?.created_at || appointment.payment_marked_at || appointment.updated_at;
  const paymentReviewMinutes = paymentReviewStartedAt
    ? dayjs().diff(dayjs(paymentReviewStartedAt), "minute")
    : null;
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
  const showPaymentUploadProgress =
    uploadingProof || (paymentUploadFailed && paymentUploadProgress > 0);
  const paymentUploadProgressSafe = Math.max(0, Math.min(100, paymentUploadProgress || 0));
  const paymentUploadButtonLabel = uploadingProof
    ? `Загружаем чек... ${paymentUploadProgressSafe > 0 ? `${paymentUploadProgressSafe}%` : ""}`.trim()
    : paymentUploadFailed
      ? "Повторить загрузку чека"
      : appointment.status === "AWAITING_PAYMENT"
        ? "Загрузить чек и продолжить"
        : "Отправить новый чек";
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
  const syncStatusText = "Автообновление статуса и чата";
  const visibleTimelineEvents = isClient
    ? timelineEvents.slice(0, isClientCompact ? 3 : 6)
    : timelineEvents;
  const sidebarTimelineEvents = isClient
    ? visibleTimelineEvents.slice(0, isClientCompact ? 2 : 4)
    : visibleTimelineEvents;
  const showCompletionHero = appointment.status === "COMPLETED";
  const rustdeskId = (appointment.rustdesk_id || "").trim();
  const rustdeskPassword = (appointment.rustdesk_password || "").trim();
  const clientProfilePath =
    !isClient && appointment.client ? `/clients/${appointment.client}/profile` : "";
  const hasRuDesktopCredentials = Boolean(rustdeskId) && ["master", "admin"].includes(user.role);
  const canLaunchRuDesktop = hasRuDesktopCredentials;
  const sidebarLinks = [
    {
      id: "rustdesk_download",
      label: "Скачать RuDesktop",
      href: RU_DESKTOP_DOWNLOAD_URL,
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
  const chatRuDesktop = {
    id: rustdeskId,
    password: rustdeskPassword,
    downloadUrl: RU_DESKTOP_DOWNLOAD_URL,
    helpUrl: RU_DESKTOP_HELP_URL,
  };
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
          key: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)
            ? "open_payment"
            : "open_chat",
          label: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)
            ? "Оплата"
            : "Чат",
          tab: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status)
            ? "payment"
            : "chat",
          icon: ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(appointment.status) ? (
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
          id: "links",
          key: "open_links",
          label: "Ссылки",
          tab: "chat",
          icon: <LinkRoundedIcon fontSize="small" />,
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
        title: "Ожидаем оплату",
        description: "Оплатите по реквизитам и напишите в чат, если нужна помощь.",
        actionKey: "open_payment",
        cta: "Перейти к оплате",
      };
    }
    if (appointment.status === "PAYMENT_PROOF_UPLOADED") {
      return {
        title: "Чек на проверке",
        description: "Обычно подтверждение занимает 1-5 минут.",
        actionKey: "open_payment",
        cta: "Открыть оплату",
      };
    }
    if (["NEW", "IN_REVIEW"].includes(appointment.status)) {
      return {
        title: "Ожидаем мастера",
        description: "Как только мастер возьмет заявку, напишем в чат.",
        actionKey: "open_chat",
        cta: "Открыть чат",
      };
    }
    if (["PAID", "IN_PROGRESS"].includes(appointment.status)) {
      return {
        title: "Работа выполняется",
        description: "Держите чат открытым.",
        actionKey: "open_chat",
        cta: "Перейти в чат",
      };
    }
    if (appointment.status === "COMPLETED") {
      return {
        title: "Заявка завершена",
        description: "Работа завершена. Если появятся вопросы — напишите в чат.",
        actionKey: "open_chat",
        cta: "Открыть чат",
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

  const scrollToSection = (sectionRef) => {
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  };

  const handlePrimaryAction = async (actionKey) => {
    if (actionKey === "open_payment") {
      if (isClient) {
        if (showClientTabs) {
          setClientTab("payment");
        }
        if (showClientPaymentActions) {
          setPaymentFocusOpen(true);
        }
      }
      paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_chat") {
      setChatPanelView("messages");
      if (isClient) {
        setClientTab("chat");
      }
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_links") {
      setChatPanelView("links");
      if (isClient) {
        setClientTab("chat");
      }
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "open_timeline") {
      if (isClient) {
        if (clientDetailsTabEnabled) {
          setClientTab("details");
        } else {
          setClientCompactView(false);
          setClientTab("details");
        }
      }
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (actionKey === "leave_review") {
      if (isClient) {
        if (clientDetailsTabEnabled) {
          setClientTab("details");
        } else {
          setClientCompactView(false);
          setClientTab("details");
        }
      }
      scrollToSection(reviewRef);
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

  return (
    <Stack spacing={isClient ? 1.35 : 2}>
      <input
        ref={paymentFileInputRef}
        hidden
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf"
        capture={isMobile ? "environment" : undefined}
        onChange={(event) => onSelectPaymentFile(event.target.files?.[0] || null)}
      />
      <Paper
        sx={{
          p: { xs: 1.8, md: 2.2 },
          borderRadius: 1.8,
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
          overflowX: "clip",
          "&:hover": isClient
            ? {
                boxShadow: isDark
                  ? "0 24px 48px rgba(2,6,23,0.62)"
                  : "0 24px 48px rgba(15,23,42,0.14)",
                borderColor: "rgba(2,132,199,0.22)",
              }
            : undefined,
        }}
      >
        <Stack spacing={1.4}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.1}
          >
            <Box>
              <Typography variant="h2">Заявка #{appointment.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {normalizeRuText(appointment.brand)} {normalizeRuText(appointment.model)} •{" "}
                {getLockTypeLabel(appointment.lock_type)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {!isClient ? (
                <Chip
                  label={statusUi.label}
                  sx={{
                    bgcolor: statusUi.bg,
                    color: statusUi.color,
                    border: `1px solid ${statusUi.color}33`,
                    fontWeight: 700,
                  }}
                />
              ) : null}
            </Stack>
          </Stack>

          {isClient || !isClientMinimal ? (
            <StatusStepper
              status={appointment.status}
              role={user.role}
              slaBreached={appointment.sla_breached}
              compact={isMobile}
            />
          ) : null}

          {isClient ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.3,
                borderRadius: 1.5,
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
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {clientFocus?.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {clientFocus?.description}
                  </Typography>
                  {!isClient && actionEtaLabel ? (
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
          ) : !isClient && !showMasterActionPanel ? (
            <PrimaryCTA
              status={appointment.status}
              role={user.role}
              onAction={handlePrimaryAction}
            />
          ) : null}

          {showClientTabs ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.78)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
              }}
            >
              <Tabs
                value={clientTab}
                onChange={(_, nextValue) => {
                  setClientTab(nextValue);
                  if (nextValue === "chat") {
                    setChatPanelView("messages");
                  }
                }}
                variant="fullWidth"
                sx={{
                  minHeight: 42,
                  "& .MuiTab-root": {
                    minHeight: 42,
                    fontWeight: 700,
                    fontSize: 13.5,
                    textTransform: "none",
                  },
                }}
              >
                <Tab
                  value="payment"
                  label="Оплата"
                  icon={<PaymentsRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  disabled={clientPaymentTabDisabled}
                />
                <Tab
                  value="chat"
                  label="Чат"
                  icon={<ForumRoundedIcon fontSize="small" />}
                  iconPosition="start"
                />
                {clientDetailsTabEnabled ? (
                  <Tab
                    value="details"
                    label="Детали"
                    icon={<InfoOutlinedIcon fontSize="small" />}
                    iconPosition="start"
                  />
                ) : null}
              </Tabs>
            </Paper>
          ) : null}
          {showClientQuickRail ? (
            <Paper
              elevation={0}
              sx={{
                p: 0.7,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? "rgba(15,23,42,0.82)" : "rgba(255,255,255,0.82)",
              }}
            >
              <Stack direction="row" spacing={0.6} sx={{ overflowX: "auto", pb: 0.2 }}>
                {clientRailActions.map((action) => {
                  const active = showClientTabs
                    ? action.id === "links"
                      ? clientTab === "chat" && chatPanelView === "links"
                      : action.id === "messages"
                        ? clientTab === "chat" && chatPanelView !== "links"
                        : clientTab === action.tab
                    : false;
                  return (
                    <Button
                      key={action.id}
                      size="small"
                      startIcon={action.icon}
                      variant={active || action.emphasis ? "contained" : "text"}
                      color={active || action.emphasis ? "primary" : "inherit"}
                      onClick={() => handlePrimaryAction(action.key)}
                      sx={{
                        borderRadius: 1.4,
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

          {!isClient ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Typography variant="caption" color="text.secondary">
                {syncStatusText}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handlePrimaryAction("open_payment")}
                >
                  К оплате
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handlePrimaryAction("open_chat")}
                >
                  К чату
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handlePrimaryAction("open_timeline")}
                >
                  К ленте
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}
      {showCompletionHero ? (
        <Paper
          sx={{
            p: { xs: 1.6, md: 2 },
            borderRadius: 1.6,
            border: "1px solid",
            borderColor: isDark ? "rgba(34,197,94,0.45)" : "rgba(16,185,129,0.32)",
            background: isDark
              ? "linear-gradient(145deg, rgba(11,35,27,0.9) 0%, rgba(15,23,42,0.9) 100%)"
              : "linear-gradient(145deg, rgba(236,253,245,0.95) 0%, rgba(255,255,255,0.95) 100%)",
            boxShadow: isDark ? "0 12px 28px rgba(2,6,23,0.55)" : "0 12px 28px rgba(15,23,42,0.08)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.2}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TaskAltRoundedIcon color="success" />
              <Stack spacing={0.2}>
                <Typography variant="h3" sx={{ fontWeight: 800 }}>
                  {isClient ? "Заказ успешно завершен" : "Работа по заявке завершена"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isClient
                    ? "Спасибо! Если захотите, оставьте короткий отзыв и создайте новую заявку в один клик."
                    : "Клиент увидит завершение автоматически. При необходимости оставьте сообщение в чате."}
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1}>
              {isClient ? (
                <Button size="small" variant="contained" onClick={() => navigate("/client/create")}>
                  Новая заявка
                </Button>
              ) : null}
              {showClientReview ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handlePrimaryAction("leave_review")}
                >
                  Оставить отзыв
                </Button>
              ) : null}
              <Button
                size="small"
                variant="outlined"
                onClick={() => handlePrimaryAction("open_chat")}
              >
                Открыть чат
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
      {showClientPaymentHighlight ? (
        <Alert
          severity={appointment.status === "AWAITING_PAYMENT" ? "warning" : "info"}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => handlePrimaryAction("open_payment")}
            >
              Перейти
            </Button>
          }
        >
          {appointment.status === "AWAITING_PAYMENT"
            ? "Сейчас главный шаг: оплата и загрузка чека. После этого мастер сразу продолжит работу."
            : "Чек загружен и уже на проверке. Обычно это занимает 1-5 минут."}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ width: "100%", m: 0, minWidth: 0 }}>
        <Grid item xs={12} lg={!isClient || showClientDesktopSidebar ? 8 : 12} sx={{ minWidth: 0 }}>
          <Stack spacing={2}>
            {showClientDataCard ? (
              <Fade in={showClientDataCard} timeout={220}>
                <Box>
                  <Paper
                    sx={{
                      p: { xs: 1.8, md: 2.2 },
                      borderRadius: 1.8,
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
                            boxShadow: isDark
                              ? "0 14px 30px rgba(2,6,23,0.5)"
                              : "0 14px 30px rgba(15,23,42,0.10)",
                            borderColor: "rgba(2,132,199,0.18)",
                          }
                        : undefined,
                    }}
                  >
                    <Typography variant="h3" sx={{ mb: 1 }}>
                      Данные заявки
                    </Typography>
                    {isClient ? (
                      <Stack spacing={1.1}>
                        <Typography variant="body2" color="text.secondary">
                          Только ключевое. Остальное открывайте по необходимости.
                        </Typography>
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={`Устройство: ${normalizeRuText(appointment.brand)} ${normalizeRuText(appointment.model)}`}
                          />
                          <Chip
                            size="small"
                            color={appointment.total_price ? "warning" : "default"}
                            label={
                              appointment.total_price
                                ? `К оплате: ${appointment.total_price} руб.`
                                : "Цена уточняется"
                            }
                          />
                          <Chip
                            size="small"
                            label={`Мастер: ${normalizeRuText(appointment.master_username) || "пока не назначен"}`}
                          />
                        </Stack>
                        <Button
                          variant={clientDataExpanded ? "outlined" : "text"}
                          size="small"
                          onClick={() => setClientDataExpanded((prev) => !prev)}
                          sx={{ alignSelf: "flex-start", px: 1.2, borderRadius: 2 }}
                        >
                          {clientDataExpanded ? "Скрыть детали" : "Показать детали"}
                        </Button>
                        {clientDataExpanded ? (
                          <Stack spacing={0.55}>
                            <Typography variant="body2">
                              <b>Тип блокировки:</b> {getLockTypeLabel(appointment.lock_type)}
                            </Typography>
                            {rustdeskId ? (
                              <Typography variant="body2">
                                <b>RuDesktop ID:</b> {rustdeskId}
                              </Typography>
                            ) : null}
                            {appointment.description ? (
                              <Typography variant="body2" color="text.secondary">
                                {normalizeRuText(appointment.description)}
                              </Typography>
                            ) : null}
                          </Stack>
                        ) : null}
                      </Stack>
                    ) : (
                      <Stack spacing={0.7}>
                        <Typography variant="body2">
                          <b>Устройство:</b> {normalizeRuText(appointment.brand)}{" "}
                          {normalizeRuText(appointment.model)}
                        </Typography>
                        <Typography variant="body2">
                          <b>Тип блокировки:</b> {getLockTypeLabel(appointment.lock_type)}
                        </Typography>
                        <Typography variant="body2">
                          <b>Цена:</b>{" "}
                          {appointment.total_price
                            ? `${appointment.total_price} руб.`
                            : "Не выставлена"}
                        </Typography>
                        <Typography variant="body2">
                          <b>Мастер:</b>{" "}
                          {normalizeRuText(appointment.master_username) ||
                            appointment.assigned_master ||
                            "Пока не назначен"}
                        </Typography>
                        <Typography variant="body2">
                          <b>Логин/ID RuDesktop:</b> {rustdeskId || "Не указан"}
                        </Typography>
                        {rustdeskPassword ? (
                          <Typography variant="body2">
                            <b>RuDesktop пароль:</b> {rustdeskPassword}
                          </Typography>
                        ) : null}
                        {appointment.description ? (
                          <Typography variant="body2">
                            <b>Комментарий:</b> {normalizeRuText(appointment.description)}
                          </Typography>
                        ) : null}
                        <Typography variant="body2">
                          <b>Есть ПК:</b> {appointment.has_pc ? "Да" : "Нет"}
                        </Typography>
                        <Typography variant="body2">
                          <b>Клиент:</b>{" "}
                          {normalizeRuText(appointment.client_username) || appointment.client}
                        </Typography>
                        {clientProfilePath ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ShieldRoundedIcon fontSize="small" />}
                            onClick={() => navigate(clientProfilePath)}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            Профиль клиента
                          </Button>
                        ) : null}
                        {appointment.is_wholesale_request ? (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label="B2B-клиент"
                            sx={{ alignSelf: "flex-start" }}
                          />
                        ) : null}
                        {appointment.photo_lock_screen_url ? (
                          <Typography variant="body2">
                            <a
                              href={appointment.photo_lock_screen_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Фото экрана блокировки
                            </a>
                          </Typography>
                        ) : null}
                        {appointment.payment_proof_url ? (
                          <Typography variant="body2">
                            <a
                              href={appointment.payment_proof_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Чек/скрин оплаты
                            </a>
                          </Typography>
                        ) : null}
                        {appointment.payment_requisites_note ? (
                          <Typography variant="body2">
                            <b>Оплата по реквизитам:</b>{" "}
                            {normalizeRuText(appointment.payment_requisites_note)}
                          </Typography>
                        ) : null}
                      </Stack>
                    )}
                  </Paper>
                </Box>
              </Fade>
            ) : null}

            {showMasterActionPanel ? (
              <Paper sx={{ p: 2.2, borderRadius: 1.8 }}>
                <Stack spacing={1.1}>
                  <Typography variant="h3">Панель действий мастера</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {showMasterTake
                      ? "Возьмите заявку, чтобы закрепить ее за собой и начать работу."
                      : showMasterReviewAndPrice
                        ? "Назначьте цену. После этого клиент сразу увидит шаг оплаты."
                        : showMasterConfirmPayment
                          ? "Проверьте чек и подтвердите оплату клиента."
                          : showMasterStart
                            ? "Оплата подтверждена. Можно запускать работу."
                            : "Работа в процессе. После завершения закройте заявку."}
                  </Typography>
                  {showMasterReviewAndPrice ? (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Цена (руб.)"
                        type="number"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        helperText="Обычно занимает 1-2 минуты"
                      />
                      <Button variant="contained" onClick={() => handlePrimaryAction("set_price")}>
                        Назначить цену
                      </Button>
                      <Button
                        color="warning"
                        variant="outlined"
                        onClick={() => runAction(() => appointmentsApi.decline(id))}
                      >
                        Отклонить
                      </Button>
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      {showMasterConfirmPayment && appointment.payment_requisites_note ? (
                        <Alert severity="info">
                          Клиент оплатил по реквизитам:{" "}
                          <b>{normalizeRuText(appointment.payment_requisites_note)}</b>
                        </Alert>
                      ) : null}
                      <PrimaryCTA
                        status={appointment.status}
                        role={user.role}
                        onAction={handlePrimaryAction}
                      />
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ) : null}

            {showMasterReviewAndPrice && showLegacyMasterCards ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  Панель действий мастера
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Цена (руб.)"
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    helperText="Обычно занимает 1-2 минуты"
                  />
                  <Button variant="outlined" onClick={() => handlePrimaryAction("set_price")}>
                    Сохранить цену
                  </Button>
                  <Button
                    color="warning"
                    variant="outlined"
                    onClick={() => runAction(() => appointmentsApi.decline(id))}
                  >
                    Отклонить
                  </Button>
                </Stack>
              </Paper>
            ) : null}

            {showMasterConfirmPayment && showLegacyMasterCards ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  Оплата клиента
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Проверьте чек и подтвердите оплату. Если не получается — напишите клиенту в чат.
                </Typography>
                {appointment.payment_requisites_note ? (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Клиент оплатил по реквизитам:{" "}
                    <b>{normalizeRuText(appointment.payment_requisites_note)}</b>
                  </Alert>
                ) : null}
                <Button variant="outlined" onClick={() => handlePrimaryAction("confirm_payment")}>
                  Подтвердить оплату
                </Button>
              </Paper>
            ) : null}

            {showMasterStart && showLegacyMasterCards ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  Запуск работы
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("start_work")}>
                  Начать работу
                </Button>
              </Paper>
            ) : null}

            {showMasterComplete && showLegacyMasterCards ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  Завершение
                </Typography>
                <Button
                  variant="outlined"
                  color="success"
                  onClick={() => handlePrimaryAction("complete_work")}
                >
                  Завершить работу
                </Button>
              </Paper>
            ) : null}

            {showMasterTake && showLegacyMasterCards ? (
              <Paper sx={{ p: 2.2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                  Новая заявка
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Что делать дальше: возьмите заявку, чтобы закрепить ее за собой.
                </Typography>
                <Button variant="outlined" onClick={() => handlePrimaryAction("take")}>
                  Взять заявку
                </Button>
              </Paper>
            ) : null}

            <Fade in={showClientPaymentCard} timeout={220} mountOnEnter unmountOnExit>
              <Box>
                <AppointmentClientPaymentCard
                  paymentRef={paymentRef}
                  isDark={isDark}
                  isMobile={isMobile}
                  appointment={appointment}
                  paymentFlowActiveStep={paymentFlowActiveStep}
                  paymentFlowLabels={paymentFlowLabels}
                  paymentReviewMinutes={paymentReviewMinutes}
                  paymentSettings={paymentSettings}
                  copyToClipboard={copyToClipboard}
                  paymentDropZoneSx={paymentDropZoneSx}
                  triggerPaymentFilePicker={triggerPaymentFilePicker}
                  setPaymentDragOver={setPaymentDragOver}
                  onPaymentDrop={onPaymentDrop}
                  paymentProofFile={paymentProofFile}
                  onSelectPaymentFile={onSelectPaymentFile}
                  paymentProofMeta={paymentProofMeta}
                  paymentFileError={paymentFileError}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  onPaymentRequisitesChange={onPaymentRequisitesChange}
                  paymentRequisitesNote={paymentRequisitesNote}
                  paymentRequisitesError={paymentRequisitesError}
                  uploadPaymentProof={uploadPaymentProof}
                  canUploadPaymentProof={canUploadPaymentProof}
                  paymentUploadButtonLabel={paymentUploadButtonLabel}
                  showPaymentUploadProgress={showPaymentUploadProgress}
                  paymentUploadProgressSafe={paymentUploadProgressSafe}
                  markPaidManually={markPaidManually}
                  paymentUploadFailed={paymentUploadFailed}
                  setPaymentFocusOpen={setPaymentFocusOpen}
                  handlePrimaryAction={handlePrimaryAction}
                />
              </Box>
            </Fade>

            {showClientSignals ? (
              <AppointmentClientSignalPanel
                clientSignal={clientSignal}
                setClientSignal={setClientSignal}
                clientSignalComment={clientSignalComment}
                setClientSignalComment={setClientSignalComment}
                sendClientSignal={sendClientSignal}
              />
            ) : null}

            {showClientRepeat && showClientSecondaryCards ? (
              <AppointmentRepeatPanel repeatAppointment={repeatAppointment} />
            ) : null}

            {showAdminControls ? (
              <AppointmentAdminControlsPanel
                appointment={appointment}
                showAdminPaymentConfirm={showAdminPaymentConfirm}
                manualStatus={manualStatus}
                setManualStatus={setManualStatus}
                manualNote={manualNote}
                setManualNote={setManualNote}
                onApplyStatus={() =>
                  runAction(() =>
                    adminApi.setStatus(id, { status: manualStatus, note: manualNote })
                  )
                }
                onConfirmPayment={() => handlePrimaryAction("confirm_payment_admin")}
              />
            ) : null}

            {showClientReviewCard ? (
              <ClientReviewCard
                reviewRef={reviewRef}
                reviewRating={reviewRating}
                setReviewRating={setReviewRating}
                reviewComment={reviewComment}
                setReviewComment={setReviewComment}
                onSubmit={() =>
                  runAction(() =>
                    reviewsApi.reviewMaster(id, { rating: reviewRating, comment: reviewComment })
                  )
                }
              />
            ) : null}

            {showMasterReviewClient ? (
              <MasterReviewClientCard
                reviewRef={reviewRef}
                reviewRating={reviewRating}
                setReviewRating={setReviewRating}
                reviewComment={reviewComment}
                setReviewComment={setReviewComment}
                clientReviewFlags={clientReviewFlags}
                setClientReviewFlags={setClientReviewFlags}
                behaviorFlags={behaviorFlags}
                onSubmit={() =>
                  runAction(() =>
                    reviewsApi.reviewClient(id, {
                      rating: reviewRating,
                      behavior_flags: clientReviewFlags,
                      comment: reviewComment,
                    })
                  )
                }
              />
            ) : null}

            <Fade in={showClientChatPanel} timeout={220} mountOnEnter unmountOnExit>
              <Box ref={chatRef}>
                <ChatPanel
                  appointmentId={id}
                  currentUser={user}
                  systemEvents={mappedSystemEvents}
                  initialView={chatPanelView}
                  downloadLinks={sidebarLinks}
                  ruDesktop={chatRuDesktop}
                  canEditRuDesktop={isClient}
                  onSaveRuDesktop={isClient ? saveClientAccessInline : null}
                  ruDesktopSaving={clientAccessSaving}
                />
              </Box>
            </Fade>

            <Fade in={showClientDetailsCard} timeout={220} mountOnEnter unmountOnExit>
              <Box>
                <AppointmentClientDetailsAccordion
                  timelineRef={timelineRef}
                  isDark={isDark}
                  appointment={appointment}
                  visibleTimelineEvents={visibleTimelineEvents}
                  getEventTitle={getEventTitle}
                />
              </Box>
            </Fade>
          </Stack>
        </Grid>

        {!isClient || showClientDesktopSidebar ? (
          <Grid item xs={12} lg={4} sx={{ minWidth: 0 }}>
            <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: { lg: 88 } }}>
              {!isClient ? (
                <AppointmentTrustSidebar
                  appointment={appointment}
                  clientProfilePath={clientProfilePath}
                  completionEtaMinutes={completionEtaMinutes}
                  formatEtaMinutes={formatEtaMinutes}
                  navigate={navigate}
                  responseEtaMinutes={responseEtaMinutes}
                />
              ) : null}

              <AppointmentLinksSidebar
                canLaunchRuDesktop={canLaunchRuDesktop}
                handlePrimaryAction={handlePrimaryAction}
                hasRuDesktopCredentials={hasRuDesktopCredentials}
                isClient={isClient}
                isMasterAssigned={isMasterAssigned}
                openRuDesktopSession={openRuDesktopSession}
                requestClientPasswordCheck={requestClientPasswordCheck}
                rustdeskId={rustdeskId}
                rustdeskPassword={rustdeskPassword}
                setClientAccessDialogOpen={setClientAccessDialogOpen}
                sidebarLinks={sidebarLinks}
                copyToClipboard={copyToClipboard}
                user={user}
              />

              {!isClient ? (
                <AppointmentTimelineSidebar
                  sidebarTimelineEvents={sidebarTimelineEvents}
                  timelineRef={timelineRef}
                  getEventTitle={getEventTitle}
                />
              ) : null}
            </Stack>
          </Grid>
        ) : null}
      </Grid>
      {showClientFloatingActionBar ? (
        <AppointmentClientFloatingActionBar
          appointmentStatus={appointment.status}
          isDark={isDark}
          handlePrimaryAction={handlePrimaryAction}
        />
      ) : null}
      {showClientPaymentDock ? (
        <AppointmentClientPaymentDock
          appointmentStatus={appointment.status}
          isDark={isDark}
          paymentProgressValue={paymentProgressValue}
          paymentReviewMinutes={paymentReviewMinutes}
          handlePrimaryAction={handlePrimaryAction}
        />
      ) : null}
      <PaymentFocusOverlay
        isMobile={isMobile}
        paymentFocusOpen={paymentFocusOpen}
        setPaymentFocusOpen={setPaymentFocusOpen}
        isDark={isDark}
        isAwaitingPayment={isAwaitingPayment}
        paymentFlowActiveStep={paymentFlowActiveStep}
        paymentFlowLabels={paymentFlowLabels}
        paymentSettings={paymentSettings}
        copyToClipboard={copyToClipboard}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onPaymentRequisitesChange={onPaymentRequisitesChange}
        paymentRequisitesNote={paymentRequisitesNote}
        paymentRequisitesError={paymentRequisitesError}
        paymentDropZoneSx={paymentDropZoneSx}
        setPaymentDragOver={setPaymentDragOver}
        onPaymentDrop={onPaymentDrop}
        triggerPaymentFilePicker={triggerPaymentFilePicker}
        paymentProofFile={paymentProofFile}
        onSelectPaymentFile={onSelectPaymentFile}
        paymentFileError={paymentFileError}
        uploadPaymentProof={uploadPaymentProof}
        canUploadPaymentProof={canUploadPaymentProof}
        paymentUploadButtonLabel={paymentUploadButtonLabel}
        showPaymentUploadProgress={showPaymentUploadProgress}
        paymentUploadProgressSafe={paymentUploadProgressSafe}
        markPaidManually={markPaidManually}
        paymentUploadFailed={paymentUploadFailed}
        handlePrimaryAction={handlePrimaryAction}
      />
      <PaymentGuideDialog
        isMobile={isMobile}
        isDark={isDark}
        open={paymentGuideOpen}
        onClose={() => setPaymentGuideOpen(false)}
        isAwaitingPayment={isAwaitingPayment}
        paymentFlowActiveStep={paymentFlowActiveStep}
        paymentFlowLabels={paymentFlowLabels}
        isPaymentProofUploaded={isPaymentProofUploaded}
        paymentReviewMinutes={paymentReviewMinutes}
        handlePrimaryAction={handlePrimaryAction}
      />
      <PaymentUploadedDialog
        isMobile={isMobile}
        isDark={isDark}
        open={paymentUploadedDialogOpen}
        onClose={() => setPaymentUploadedDialogOpen(false)}
        handlePrimaryAction={handlePrimaryAction}
      />
      <ClientAccessDialog
        open={clientAccessDialogOpen}
        onClose={() => setClientAccessDialogOpen(false)}
        clientAccessForm={clientAccessForm}
        setClientAccessForm={setClientAccessForm}
        saveClientAccessData={saveClientAccessData}
        clientAccessSaving={clientAccessSaving}
      />
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
            borderRadius: 1.4,
            boxShadow: isDark ? "0 12px 28px rgba(2,6,23,0.56)" : "0 10px 24px rgba(15,23,42,0.14)",
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
