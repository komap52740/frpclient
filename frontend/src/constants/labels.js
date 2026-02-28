export const APPOINTMENT_STATUS_OPTIONS = [
  "NEW",
  "IN_REVIEW",
  "AWAITING_PAYMENT",
  "PAYMENT_PROOF_UPLOADED",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED_BY_MASTER",
  "CANCELLED",
];

export const STATUS_LABELS = {
  NEW: "Новая",
  IN_REVIEW: "На проверке",
  AWAITING_PAYMENT: "Ожидает оплату",
  PAYMENT_PROOF_UPLOADED: "Чек загружен",
  PAID: "Оплачено",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершено",
  DECLINED_BY_MASTER: "Отклонено мастером",
  CANCELLED: "Отменено",
};

export const LOCK_TYPE_LABELS = {
  PIN: "PIN-код",
  GOOGLE: "Google-аккаунт",
  APPLE_ID: "Apple ID",
  OTHER: "Другое",
};

export const PAYMENT_METHOD_LABELS = {
  bank_transfer: "Банковский перевод",
  crypto: "Криптовалюта",
};

export const CLIENT_LEVEL_LABELS = {
  newbie: "Новичок",
  trusted: "Проверенный",
  reliable: "Надежный",
  problematic: "Проблемный",
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

export function getLockTypeLabel(lockType) {
  return LOCK_TYPE_LABELS[lockType] || lockType || "-";
}

export function getPaymentMethodLabel(paymentMethod) {
  return PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod || "-";
}

export function getClientLevelLabel(level) {
  return CLIENT_LEVEL_LABELS[level] || level || "-";
}
