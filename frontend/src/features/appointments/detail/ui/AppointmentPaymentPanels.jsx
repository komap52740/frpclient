import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";

import { getPaymentMethodLabel } from "../../../../constants/labels";

export function AppointmentClientPaymentCard({
  paymentRef,
  isDark,
  isMobile,
  appointment,
  paymentFlowActiveStep,
  paymentFlowLabels,
  paymentReviewMinutes,
  paymentSettings,
  copyToClipboard,
  paymentDropZoneSx,
  triggerPaymentFilePicker,
  setPaymentDragOver,
  onPaymentDrop,
  paymentProofFile,
  onSelectPaymentFile,
  paymentProofMeta,
  paymentFileError,
  paymentMethod,
  setPaymentMethod,
  onPaymentRequisitesChange,
  paymentRequisitesNote,
  paymentRequisitesError,
  uploadPaymentProof,
  canUploadPaymentProof,
  paymentUploadButtonLabel,
  showPaymentUploadProgress,
  paymentUploadProgressSafe,
  markPaidManually,
  paymentUploadFailed,
  setPaymentFocusOpen,
  handlePrimaryAction,
}) {
  return (
    <Paper
      ref={paymentRef}
      sx={{
        p: { xs: 1.8, md: 2.2 },
        borderRadius: 1.8,
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
        "&:hover": {
          boxShadow: isDark ? "0 18px 34px rgba(2,6,23,0.6)" : "0 18px 34px rgba(15,23,42,0.12)",
        },
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
        <Typography variant="body2">
          <b>СБП:</b> {paymentSettings?.bank_requisites || "не указано"}
        </Typography>
        <Typography variant="body2">
          <b>Криптовалюта:</b> {paymentSettings?.crypto_requisites || "не указано"}
        </Typography>
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
              {appointment.status === "AWAITING_PAYMENT"
                ? "Выберите или перетащите файл чека"
                : "Загрузите новый чек"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Форматы: jpg, jpeg, png, webp, heic, heif, pdf. Максимум 100 МБ.
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
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => onSelectPaymentFile(null)}
            >
              Очистить
            </Button>
          ) : null}
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: paymentProofFile ? 700 : 500 }}>
          {paymentProofMeta}
        </Typography>
        {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

        <TextField
          select
          label="Способ оплаты"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
        >
          <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
          <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
        </TextField>
        <TextField
          label="По каким реквизитам оплатили"
          value={paymentRequisitesNote}
          onChange={onPaymentRequisitesChange}
          error={Boolean(paymentRequisitesError)}
          helperText={
            paymentRequisitesError || "Это увидят мастер и админ для ручной проверки оплаты."
          }
        />

        <Button
          variant="contained"
          size="large"
          onClick={uploadPaymentProof}
          disabled={!canUploadPaymentProof}
        >
          {paymentUploadButtonLabel}
        </Button>
        {showPaymentUploadProgress ? (
          <LinearProgress
            variant={paymentUploadProgressSafe > 0 ? "determinate" : "indeterminate"}
            value={paymentUploadProgressSafe > 0 ? paymentUploadProgressSafe : undefined}
            sx={{ borderRadius: 1 }}
          />
        ) : null}

        {appointment.status === "AWAITING_PAYMENT" ? (
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              После загрузки статус обычно меняется автоматически за 1-2 минуты.
            </Typography>
            <Button size="small" variant="text" onClick={markPaidManually}>
              Не обновилось? Нажать «Я оплатил»
            </Button>
            {paymentUploadFailed ? (
              <Button
                size="small"
                variant="outlined"
                onClick={uploadPaymentProof}
                disabled={!canUploadPaymentProof}
              >
                Повторить загрузку чека
              </Button>
            ) : null}
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
  );
}

export function PaymentFocusOverlay(props) {
  const {
    isMobile,
    paymentFocusOpen,
    setPaymentFocusOpen,
    isDark,
    isAwaitingPayment,
    paymentFlowActiveStep,
    paymentFlowLabels,
    paymentSettings,
    copyToClipboard,
    paymentMethod,
    setPaymentMethod,
    onPaymentRequisitesChange,
    paymentRequisitesNote,
    paymentRequisitesError,
    paymentDropZoneSx,
    setPaymentDragOver,
    onPaymentDrop,
    triggerPaymentFilePicker,
    paymentProofFile,
    onSelectPaymentFile,
    paymentFileError,
    uploadPaymentProof,
    canUploadPaymentProof,
    paymentUploadButtonLabel,
    showPaymentUploadProgress,
    paymentUploadProgressSafe,
    markPaidManually,
    paymentUploadFailed,
    handlePrimaryAction,
  } = props;

  const shellProps = isMobile
    ? {
        component: Drawer,
        extraProps: {
          anchor: "bottom",
          open: paymentFocusOpen,
          onClose: () => setPaymentFocusOpen(false),
          PaperProps: {
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
          },
        },
      }
    : {
        component: Dialog,
        extraProps: {
          open: paymentFocusOpen,
          onClose: () => setPaymentFocusOpen(false),
          fullWidth: true,
          maxWidth: "sm",
          PaperProps: {
            sx: {
              borderRadius: 1.8,
              border: "1px solid",
              borderColor: "divider",
              background: isDark
                ? "linear-gradient(160deg, rgba(10,17,31,0.98) 0%, rgba(15,23,42,0.96) 100%)"
                : "linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(246,251,255,0.96) 100%)",
            },
          },
        },
      };

  const ContentShell = shellProps.component;

  const content = (
    <Stack spacing={1.2} sx={isMobile ? undefined : { p: 0 }}>
      <Stack spacing={0.4}>
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          {isAwaitingPayment
            ? "Быстрый режим оплаты"
            : isMobile
              ? "Чек на проверке"
              : "Быстрый режим проверки"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isAwaitingPayment
            ? isMobile
              ? "Оплатите, загрузите чек и сразу переходите в чат."
              : "Оплата -> чек -> подтверждение. Все в одном окне."
            : isMobile
              ? "Чек уже у мастера. Если есть вопрос — откройте чат."
              : "Чек отправлен. При необходимости напишите мастеру в чат."}
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
          <b>СБП:</b> {paymentSettings?.bank_requisites || "не указано"}
        </Typography>
        <Typography variant="body2">
          <b>Криптовалюта:</b> {paymentSettings?.crypto_requisites || "не указано"}
        </Typography>
      </Stack>

      <Stack direction={isMobile ? "row" : { xs: "column", sm: "row" }} spacing={1}>
        <Button
          fullWidth={isMobile}
          variant="outlined"
          size="small"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          onClick={() => copyToClipboard(paymentSettings?.bank_requisites)}
        >
          {isMobile ? "СБП" : "Скопировать СБП"}
        </Button>
        <Button
          fullWidth={isMobile}
          variant="outlined"
          size="small"
          startIcon={<ContentCopyRoundedIcon fontSize="small" />}
          onClick={() => copyToClipboard(paymentSettings?.crypto_requisites)}
        >
          {isMobile ? "Крипта" : "Скопировать крипту"}
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
      <TextField
        label="По каким реквизитам оплатили"
        value={paymentRequisitesNote}
        onChange={onPaymentRequisitesChange}
        error={Boolean(paymentRequisitesError)}
        helperText={
          paymentRequisitesError || "Это увидят мастер и админ для ручной проверки оплаты."
        }
      />

      <Box
        component={isMobile ? "div" : "label"}
        sx={paymentDropZoneSx}
        onClick={isMobile ? triggerPaymentFilePicker : undefined}
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
            Форматы: jpg, jpeg, png, webp, heic, heif, pdf. Максимум 100 МБ.
          </Typography>
        </Stack>
        {!isMobile ? (
          <input
            hidden
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf"
            onChange={(event) => onSelectPaymentFile(event.target.files?.[0] || null)}
          />
        ) : null}
      </Box>

      {isMobile ? (
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
      ) : null}

      <Typography variant="body2">
        {paymentProofFile ? paymentProofFile.name : "Файл не выбран"}
      </Typography>
      {paymentFileError ? <Alert severity="warning">{paymentFileError}</Alert> : null}

      <Button
        variant="contained"
        size="large"
        onClick={uploadPaymentProof}
        disabled={!canUploadPaymentProof}
      >
        {paymentUploadButtonLabel}
      </Button>
      {showPaymentUploadProgress ? (
        <LinearProgress
          variant={paymentUploadProgressSafe > 0 ? "determinate" : "indeterminate"}
          value={paymentUploadProgressSafe > 0 ? paymentUploadProgressSafe : undefined}
          sx={{ borderRadius: 1 }}
        />
      ) : null}

      {isAwaitingPayment ? (
        <Stack spacing={0.6}>
          <Button size="small" variant="text" onClick={markPaidManually}>
            Не обновилось? Нажать «Я оплатил»
          </Button>
          {paymentUploadFailed ? (
            <Button
              size="small"
              variant="outlined"
              onClick={uploadPaymentProof}
              disabled={!canUploadPaymentProof}
            >
              Повторить загрузку чека
            </Button>
          ) : null}
        </Stack>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button fullWidth={isMobile} onClick={() => setPaymentFocusOpen(false)}>
          Закрыть
        </Button>
        <Button
          fullWidth={isMobile}
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
  );

  if (isMobile) {
    return <ContentShell {...shellProps.extraProps}>{content}</ContentShell>;
  }

  return (
    <ContentShell {...shellProps.extraProps}>
      <DialogTitle sx={{ pb: 0.8 }} />
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions sx={{ px: 0, py: 0, display: "none" }} />
    </ContentShell>
  );
}

export function PaymentGuideDialog({
  isMobile,
  isDark,
  open,
  onClose,
  isAwaitingPayment,
  paymentFlowActiveStep,
  paymentFlowLabels,
  isPaymentProofUploaded,
  paymentReviewMinutes,
  handlePrimaryAction,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 1.8,
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
            {isAwaitingPayment
              ? "Следующий шаг: оплата и чек"
              : "Чек отправлен, ожидаем подтверждение"}
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
            Если что-то не получается, нажмите «Открыть чат» и отправьте одно короткое сообщение
            мастеру.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>Позже</Button>
        <Button
          variant="contained"
          onClick={() => {
            onClose();
            handlePrimaryAction(isAwaitingPayment ? "open_payment" : "open_chat");
          }}
        >
          {isAwaitingPayment ? "Перейти к оплате" : "Открыть чат"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PaymentUploadedDialog({ isMobile, isDark, open, onClose, handlePrimaryAction }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isMobile}
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 1.8,
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
        <Button onClick={onClose}>Понятно</Button>
        <Button
          variant="contained"
          onClick={() => {
            onClose();
            handlePrimaryAction("open_chat");
          }}
        >
          Открыть чат
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ClientAccessDialog({
  open,
  onClose,
  clientAccessForm,
  setClientAccessForm,
  saveClientAccessData,
  clientAccessSaving,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Данные RuDesktop</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.2} sx={{ pt: 0.4 }}>
          <Typography variant="caption" color="text.secondary">
            Эти данные можно обновить в любой момент. Мастер увидит их сразу.
          </Typography>
          <TextField
            label="Логин/ID RuDesktop"
            value={clientAccessForm.rustdesk_id}
            onChange={(event) =>
              setClientAccessForm((prev) => ({
                ...prev,
                rustdesk_id: event.target.value.replace(/[^\d\s-]/g, ""),
              }))
            }
            autoComplete="off"
          />
          <TextField
            label="Пароль RuDesktop"
            value={clientAccessForm.rustdesk_password}
            onChange={(event) =>
              setClientAccessForm((prev) => ({
                ...prev,
                rustdesk_password: event.target.value,
              }))
            }
            autoComplete="off"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={saveClientAccessData} disabled={clientAccessSaving}>
          {clientAccessSaving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
