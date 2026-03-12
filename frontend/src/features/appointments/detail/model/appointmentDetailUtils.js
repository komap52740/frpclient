import dayjs from "dayjs";

import { getStatusLabel } from "../../../../constants/labels";
import { normalizeRuText } from "../../../../utils/text";

export const behaviorFlags = [
  { code: "bad_internet", label: "Проблемный интернет" },
  { code: "weak_pc", label: "Слабый ПК" },
  { code: "difficult_client", label: "Сложный клиент" },
  { code: "did_not_follow_instructions", label: "Не следовал инструкциям" },
  { code: "late_to_session", label: "Опоздал к подключению" },
  { code: "good_connection", label: "Отличная связь" },
  { code: "well_prepared", label: "Подготовлен заранее" },
];

export const CLIENT_SIGNAL_OPTIONS = [
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

export function getEventTitle(event) {
  if (event.event_type === "client_signal") {
    const signalLabel = CLIENT_SIGNAL_OPTIONS.find(
      (option) => option.value === event.metadata?.signal
    )?.label;
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

export function buildFallbackEvents(appointment) {
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

export function validatePaymentFile(file) {
  if (!file) {
    return "Выберите файл чека";
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];
  const allowedMimePrefixes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];
  const hasAllowedExtension = allowedExtensions.includes(ext);
  const hasAllowedMime = allowedMimePrefixes.some((prefix) => mime.startsWith(prefix));
  if (!hasAllowedExtension && !hasAllowedMime) {
    return "Формат файла: jpg, jpeg, png, webp, heic, heif или pdf";
  }
  if (file.size > 100 * 1024 * 1024) {
    return "Размер файла не должен превышать 100 МБ";
  }
  return "";
}

export function validatePaymentRequisitesNote(value) {
  const note = (value || "").trim();
  if (note.length < 3) {
    return "Укажите, по каким реквизитам оплатили (минимум 3 символа)";
  }
  return "";
}

function extractApiErrorText(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data?.detail === "string") return data.detail.trim();
  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") {
    return data.detail[0].trim();
  }

  const priorityKeys = ["payment_proof", "non_field_errors", "error"];
  for (const key of priorityKeys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim())
      return value[0].trim();
  }

  for (const value of Object.values(data || {})) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim())
      return value[0].trim();
  }
  return "";
}

export function resolvePaymentUploadError(error) {
  const statusCode = error?.response?.status;
  const rawDetail = extractApiErrorText(error?.response?.data);
  const detail = normalizeRuText(
    rawDetail ? rawDetail : "Не удалось загрузить чек. Проверьте файл и попробуйте снова."
  );

  if (!error?.response) {
    return "Нет соединения с сервером. Проверьте интернет и повторите загрузку.";
  }
  if (statusCode === 413) {
    return "Файл слишком большой. Максимальный размер чека 100 МБ.";
  }
  if (statusCode === 415) {
    return "Формат файла не поддерживается. Используйте jpg, jpeg, png, webp, heic, heif или pdf.";
  }
  if (statusCode >= 500) {
    return "Сервер временно недоступен. Повторите загрузку через несколько секунд.";
  }
  return detail;
}

export function getLatestEventId(eventItems = []) {
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

export function dedupeEvents(eventItems = []) {
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

export function areEventListsEqual(prevEvents = [], nextEvents = []) {
  if (prevEvents.length !== nextEvents.length) {
    return false;
  }
  for (let index = 0; index < prevEvents.length; index += 1) {
    const prev = prevEvents[index];
    const next = nextEvents[index];
    if (prev.id !== next.id || getEventFingerprint(prev) !== getEventFingerprint(next)) {
      return false;
    }
  }
  return true;
}

export function getAppointmentSnapshot(appointment) {
  if (!appointment || typeof appointment !== "object") {
    return "";
  }
  try {
    return JSON.stringify(appointment);
  } catch {
    return `${appointment.id || ""}|${appointment.status || ""}|${appointment.updated_at || ""}`;
  }
}

export function formatEtaMinutes(minutes) {
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

export function resolveClientActionByStatus(status) {
  if (["AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED"].includes(status)) {
    return "open_payment";
  }
  if (status === "COMPLETED") {
    return "leave_review";
  }
  return "open_chat";
}
