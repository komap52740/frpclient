import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { adminApi, appointmentsApi, reviewsApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ChatPanel from "../components/ChatPanel";
import StatusChip from "../components/StatusChip";
import {
  APPOINTMENT_STATUS_OPTIONS,
  getLockTypeLabel,
  getPaymentMethodLabel,
  getStatusLabel,
} from "../constants/labels";

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

const EVENT_LABELS = {
  status_changed: "Смена статуса",
  price_set: "Назначена цена",
  payment_proof_uploaded: "Загружен чек",
  payment_marked: "Клиент отметил оплату",
  payment_confirmed: "Оплата подтверждена",
  message_deleted: "Удалено сообщение",
};

function getEventTitle(event) {
  if (event.event_type === "status_changed") {
    const from = getStatusLabel(event.from_status);
    const to = getStatusLabel(event.to_status);
    return `${EVENT_LABELS.status_changed}: ${from} -> ${to}`;
  }
  return EVENT_LABELS[event.event_type] || event.event_type;
}

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const { user, paymentSettings } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [clientReviewFlags, setClientReviewFlags] = useState([]);

  const [manualStatus, setManualStatus] = useState("NEW");
  const [manualNote, setManualNote] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [appointmentResponse, eventsResponse] = await Promise.all([
        appointmentsApi.detail(id),
        appointmentsApi.events(id),
      ]);
      setAppointment(appointmentResponse.data);
      setEvents(eventsResponse.data || []);
      setPrice(appointmentResponse.data.total_price || "");
      setManualStatus(appointmentResponse.data.status);
      setError("");
    } catch {
      setError("Не удалось загрузить заявку");
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = async (action) => {
    try {
      await action();
      await loadData();
      setSuccess("Действие выполнено");
      setError("");
    } catch (err) {
      setSuccess("");
      setError(err.response?.data?.detail || "Ошибка выполнения действия");
    }
  };

  if (!appointment) {
    return <Typography>Загрузка...</Typography>;
  }

  const isMasterAssigned = user.role === "master" && appointment.assigned_master === user.id;

  const showClientPaymentActions = user.role === "client" && appointment.status === "AWAITING_PAYMENT";
  const showClientReview = user.role === "client" && appointment.status === "COMPLETED";

  const showMasterTake = user.role === "master" && appointment.status === "NEW";
  const showMasterReviewAndPrice = isMasterAssigned && appointment.status === "IN_REVIEW";
  const showMasterConfirmPayment = isMasterAssigned && appointment.status === "PAYMENT_PROOF_UPLOADED";
  const showMasterStart = isMasterAssigned && appointment.status === "PAID";
  const showMasterComplete = isMasterAssigned && appointment.status === "IN_PROGRESS";
  const showMasterReviewClient = isMasterAssigned && appointment.status === "COMPLETED";

  const showAdminControls = user.role === "admin";
  const showAdminPaymentConfirm = showAdminControls && appointment.status === "PAYMENT_PROOF_UPLOADED";

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">Заявка #{appointment.id}</Typography>
          <StatusChip status={appointment.status} />
        </Stack>

        <Typography><b>Телефон:</b> {appointment.brand} {appointment.model}</Typography>
        <Typography><b>Тип блокировки:</b> {getLockTypeLabel(appointment.lock_type)}</Typography>
        <Typography><b>Есть ПК:</b> {appointment.has_pc ? "Да" : "Нет"}</Typography>
        <Typography><b>Описание:</b> {appointment.description}</Typography>
        <Typography><b>Клиент:</b> {appointment.client_username || appointment.client}</Typography>
        <Typography><b>Мастер:</b> {appointment.master_username || appointment.assigned_master || "-"}</Typography>
        <Typography><b>Цена:</b> {appointment.total_price ? `${appointment.total_price} руб.` : "Не выставлена"}</Typography>

        {appointment.photo_lock_screen_url && (
          <Typography>
            <a href={appointment.photo_lock_screen_url} target="_blank" rel="noreferrer">
              Фото экрана блокировки
            </a>
          </Typography>
        )}

        {appointment.payment_proof_url && (
          <Typography>
            <a href={appointment.payment_proof_url} target="_blank" rel="noreferrer">
              Чек/скрин оплаты
            </a>
          </Typography>
        )}
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {showMasterTake && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Button variant="contained" onClick={() => runAction(() => appointmentsApi.take(id))}>Взять заявку</Button>
        </Paper>
      )}

      {showMasterReviewAndPrice && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Цена (руб.)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button variant="contained" onClick={() => runAction(() => appointmentsApi.setPrice(id, Number(price)))}>
              Выставить цену
            </Button>
            <Button color="warning" onClick={() => runAction(() => appointmentsApi.decline(id))}>
              Отклонить
            </Button>
          </Stack>
        </Paper>
      )}

      {showClientPaymentActions && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" mb={1}>Оплата (100% предоплата)</Typography>
          <Typography variant="body2">Банк: {paymentSettings?.bank_requisites || "не указано"}</Typography>
          <Typography variant="body2">Криптовалюта: {paymentSettings?.crypto_requisites || "не указано"}</Typography>
          <Typography variant="body2" mb={1}>{paymentSettings?.instructions || ""}</Typography>

          <Stack spacing={1}>
            <Button component="label" variant="outlined">
              Загрузить чек
              <input hidden type="file" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} />
            </Button>
            <Typography variant="body2">{paymentProofFile ? paymentProofFile.name : "Файл не выбран"}</Typography>

            <Button
              variant="contained"
              onClick={() =>
                runAction(async () => {
                  const fd = new FormData();
                  if (paymentProofFile) {
                    fd.append("payment_proof", paymentProofFile);
                    await appointmentsApi.uploadPaymentProof(id, fd);
                  }
                })
              }
            >
              Загрузить чек
            </Button>

            <TextField
              select
              label="Способ оплаты"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <MenuItem value="bank_transfer">{getPaymentMethodLabel("bank_transfer")}</MenuItem>
              <MenuItem value="crypto">{getPaymentMethodLabel("crypto")}</MenuItem>
            </TextField>

            <Button variant="contained" color="secondary" onClick={() => runAction(() => appointmentsApi.markPaid(id, paymentMethod))}>
              Я оплатил
            </Button>
          </Stack>
        </Paper>
      )}

      {showMasterConfirmPayment && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Button variant="contained" onClick={() => runAction(() => appointmentsApi.confirmPayment(id))}>
            Подтвердить оплату
          </Button>
        </Paper>
      )}

      {showAdminControls && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {showAdminPaymentConfirm && (
              <Button variant="contained" onClick={() => runAction(() => adminApi.confirmPayment(id))}>
                Подтвердить оплату (админ)
              </Button>
            )}
            <TextField select label="Сменить статус" value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
              {APPOINTMENT_STATUS_OPTIONS.map((status) => <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>)}
            </TextField>
            <TextField label="Комментарий" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
            <Button variant="outlined" onClick={() => runAction(() => adminApi.setStatus(id, { status: manualStatus, note: manualNote }))}>
              Применить статус
            </Button>
          </Stack>
        </Paper>
      )}

      {showMasterStart && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Button variant="contained" onClick={() => runAction(() => appointmentsApi.start(id))}>Начать работу</Button>
        </Paper>
      )}

      {showMasterComplete && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Button variant="contained" color="success" onClick={() => runAction(() => appointmentsApi.complete(id))}>Работа завершена</Button>
        </Paper>
      )}

      {showClientReview && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" mb={1}>Отзыв мастеру</Typography>
          <Stack spacing={1}>
            <TextField type="number" label="Рейтинг 1-5" value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} />
            <TextField label="Комментарий" multiline minRows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            <Button variant="contained" onClick={() => runAction(() => reviewsApi.reviewMaster(id, { rating: reviewRating, comment: reviewComment }))}>
              Отправить отзыв
            </Button>
          </Stack>
        </Paper>
      )}

      {showMasterReviewClient && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" mb={1}>Оценка клиента</Typography>
          <Stack spacing={1}>
            <TextField type="number" label="Рейтинг 1-5" value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} />
            <TextField
              select
              label="Флаги поведения"
              SelectProps={{ multiple: true }}
              value={clientReviewFlags}
              onChange={(e) => setClientReviewFlags(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
            >
              {behaviorFlags.map((f) => (
                <MenuItem key={f.code} value={f.code}>{f.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Комментарий" multiline minRows={2} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            <Button
              variant="contained"
              onClick={() => runAction(() => reviewsApi.reviewClient(id, { rating: reviewRating, behavior_flags: clientReviewFlags, comment: reviewComment }))}
            >
              Сохранить оценку клиента
            </Button>
          </Stack>
        </Paper>
      )}

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h6" mb={1}>Лента событий</Typography>
        {events.length ? (
          <Stack spacing={1}>
            {events.map((event, index) => (
              <Stack key={event.id} spacing={0.5}>
                <Typography variant="body2"><b>{getEventTitle(event)}</b></Typography>
                {event.note ? <Typography variant="caption" color="text.secondary">{event.note}</Typography> : null}
                <Typography variant="caption" color="text.secondary">
                  {event.actor_username || "Система"} | {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                </Typography>
                {index < events.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">События пока отсутствуют.</Typography>
        )}
      </Paper>

      <ChatPanel appointmentId={id} currentUser={user} />
    </Stack>
  );
}
