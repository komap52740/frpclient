import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import {
  Alert,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../../../constants/labels";
import { normalizeRuText } from "../../../../utils/text";
import { CLIENT_SIGNAL_OPTIONS } from "../model/appointmentDetailUtils";

export function AppointmentClientSignalPanel({
  clientSignal,
  setClientSignal,
  clientSignalComment,
  setClientSignalComment,
  sendClientSignal,
}) {
  return (
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
          helperText={
            CLIENT_SIGNAL_OPTIONS.find((option) => option.value === clientSignal)?.helper || ""
          }
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
  );
}

export function AppointmentRepeatPanel({ repeatAppointment }) {
  return (
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
  );
}

export function AppointmentAdminControlsPanel({
  appointment,
  showAdminPaymentConfirm,
  manualStatus,
  setManualStatus,
  manualNote,
  setManualNote,
  onApplyStatus,
  onConfirmPayment,
}) {
  return (
    <Paper sx={{ p: 2.2 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>
        Управление заявкой (админ)
      </Typography>
      <Stack spacing={1}>
        {showAdminPaymentConfirm ? (
          <Stack spacing={1}>
            {appointment.payment_requisites_note ? (
              <Alert severity="info">
                Клиент оплатил по реквизитам:{" "}
                <b>{normalizeRuText(appointment.payment_requisites_note)}</b>
              </Alert>
            ) : null}
            <Button variant="outlined" onClick={onConfirmPayment}>
              Подтвердить оплату
            </Button>
          </Stack>
        ) : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select
            label="Сменить статус"
            value={manualStatus}
            onChange={(event) => setManualStatus(event.target.value)}
          >
            {APPOINTMENT_STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>
                {getStatusLabel(status)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Комментарий"
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
          />
          <Button variant="outlined" onClick={onApplyStatus}>
            Применить
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function AppointmentClientFloatingActionBar({
  appointmentStatus,
  isDark,
  handlePrimaryAction,
}) {
  const showPaymentAction = ["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(
    appointmentStatus
  );

  return (
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
        borderRadius: 1.5,
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
          variant={showPaymentAction ? "contained" : "text"}
          onClick={() => handlePrimaryAction(showPaymentAction ? "open_payment" : "open_chat")}
        >
          {showPaymentAction ? "Оплата" : "Помощь"}
        </Button>
      </Stack>
    </Paper>
  );
}

export function AppointmentClientPaymentDock({
  appointmentStatus,
  isDark,
  paymentProgressValue,
  paymentReviewMinutes,
  handlePrimaryAction,
}) {
  const paymentFlowStatusesDone = ["PAYMENT_PROOF_UPLOADED", "PAID", "IN_PROGRESS", "COMPLETED"];
  const paymentConfirmedStatuses = ["PAID", "IN_PROGRESS", "COMPLETED"];
  const isAwaitingPayment = appointmentStatus === "AWAITING_PAYMENT";
  const isPaymentProofUploaded = appointmentStatus === "PAYMENT_PROOF_UPLOADED";

  return (
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
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: isDark ? "rgba(255,179,71,0.5)" : "warning.light",
        boxShadow: (theme) =>
          isDark ? "0 18px 42px rgba(2,6,23,0.62)" : `0 18px 42px ${theme.palette.warning.light}55`,
        bgcolor: isDark ? "rgba(22,27,38,0.95)" : "#fffdfa",
      }}
    >
      <Stack spacing={0.8}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {isAwaitingPayment ? "Оплата ожидает вашего действия" : "Чек отправлен на проверку"}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={paymentProgressValue}
          sx={{ borderRadius: 1, height: 8 }}
        />
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label="1) Оплата"
            color={isAwaitingPayment ? "warning" : "success"}
            variant={isAwaitingPayment ? "filled" : "outlined"}
          />
          <Chip
            size="small"
            label="2) Чек"
            color={paymentFlowStatusesDone.includes(appointmentStatus) ? "success" : "default"}
            variant={paymentFlowStatusesDone.includes(appointmentStatus) ? "outlined" : "filled"}
          />
          <Chip
            size="small"
            label="3) Подтверждение"
            color={
              paymentConfirmedStatuses.includes(appointmentStatus)
                ? "success"
                : isPaymentProofUploaded
                  ? "warning"
                  : "default"
            }
            variant={paymentConfirmedStatuses.includes(appointmentStatus) ? "outlined" : "filled"}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {isAwaitingPayment
            ? "Сначала оплатите и загрузите чек. Статус оплаты отмечается автоматически, обычно за 1-2 минуты."
            : "Пока идет проверка, держите открытым чат. Если ответа нет 5 минут — напишите мастеру."}
        </Typography>
        {isPaymentProofUploaded && paymentReviewMinutes != null ? (
          <Alert severity={paymentReviewMinutes >= 10 ? "warning" : "info"} sx={{ py: 0 }}>
            {paymentReviewMinutes < 1
              ? "Проверка чека началась только что."
              : `Проверка чека идет ${paymentReviewMinutes} мин.`}
            {paymentReviewMinutes >= 10
              ? " Если затянулось — откройте чат и напишите мастеру."
              : ""}
          </Alert>
        ) : null}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => handlePrimaryAction(isAwaitingPayment ? "open_payment" : "open_chat")}
          >
            {isAwaitingPayment ? "Перейти к оплате" : "Открыть чат"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
