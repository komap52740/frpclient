import { STATUS_UI } from "../theme/status";

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

export const STATUS_LABELS = APPOINTMENT_STATUS_OPTIONS.reduce((acc, status) => {
  acc[status] = STATUS_UI[status]?.label || status;
  return acc;
}, {});

export const LOCK_TYPE_LABELS = {
  GOOGLE: "Google",
  HUAWEI_ID: "Huawei ID",
  MI_ACC: "Mi Acc",
  OTHER: "Другое",
  PIN: "PIN-код",
  APPLE_ID: "Apple ID",
};

export const PAYMENT_METHOD_LABELS = {
  bank_transfer: "СБП",
  crypto: "Криптовалюта",
};

export const CLIENT_LEVEL_LABELS = {
  newbie: "Новичок",
  trusted: "Проверенный",
  reliable: "Надежный",
  problematic: "Проблемный",
};

export const RISK_LEVEL_LABELS = {
  low: "Низкий риск",
  medium: "Средний риск",
  high: "Высокий риск",
  critical: "Критический риск",
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

export function getStatusHint(status) {
  return STATUS_UI[status]?.hint || "";
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

export function getRiskLevelLabel(level) {
  return RISK_LEVEL_LABELS[level] || level || "-";
}
