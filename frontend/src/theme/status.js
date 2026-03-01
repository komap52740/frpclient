const STATUS_BASE = {
  NEW: {
    label: "Новая",
    stepLabel: "Заявка создана",
    hint: "Мы подбираем мастера",
    color: "#2678d8",
    bg: "#eaf2ff",
  },
  IN_REVIEW: {
    label: "На проверке",
    stepLabel: "Мастер подключился",
    hint: "Уточняем детали и готовим цену",
    color: "#0d6e9f",
    bg: "#e8f5fb",
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплату",
    stepLabel: "Ожидаем оплату",
    hint: "Оплатите и прикрепите чек",
    color: "#d1890f",
    bg: "#fff6e6",
  },
  PAYMENT_PROOF_UPLOADED: {
    label: "Чек загружен",
    stepLabel: "Проверяем оплату",
    hint: "Проверка обычно занимает 1-5 минут",
    color: "#b8740f",
    bg: "#fff1dc",
  },
  PAID: {
    label: "Оплачено",
    stepLabel: "Оплата подтверждена",
    hint: "Можно начинать работу",
    color: "#0fa37f",
    bg: "#e8fbf5",
  },
  IN_PROGRESS: {
    label: "В работе",
    stepLabel: "Работа выполняется",
    hint: "Мастер работает над разблокировкой",
    color: "#0a567c",
    bg: "#e8f2f8",
  },
  COMPLETED: {
    label: "Завершено",
    stepLabel: "Готово",
    hint: "Проверьте устройство и оставьте отзыв",
    color: "#1c9a4d",
    bg: "#eaf8ef",
  },
  DECLINED_BY_MASTER: {
    label: "Отклонено мастером",
    stepLabel: "Заявка отклонена",
    hint: "Создайте новую заявку, если актуально",
    color: "#c63f38",
    bg: "#fdeceb",
  },
  CANCELLED: {
    label: "Отменено",
    stepLabel: "Заявка отменена",
    hint: "Вы можете создать новую заявку в любой момент",
    color: "#7b8496",
    bg: "#f0f3f7",
  },
};

export const SLA_BREACH_STATUS = "SLA_BREACHED";

export const STATUS_UI = {
  ...STATUS_BASE,
  [SLA_BREACH_STATUS]: {
    label: "Нарушен SLA",
    stepLabel: "Требует внимания",
    hint: "Мы уже уведомили администратора",
    color: "#c63f38",
    bg: "#fdeceb",
  },
};

export const STATUS_PROGRESS_ORDER = [
  "NEW",
  "IN_REVIEW",
  "AWAITING_PAYMENT",
  "PAYMENT_PROOF_UPLOADED",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
];

export function resolveStatusUI(status, slaBreached = false) {
  if (slaBreached) {
    return STATUS_UI[SLA_BREACH_STATUS];
  }
  return STATUS_UI[status] || {
    label: status || "Неизвестно",
    stepLabel: status || "Неизвестно",
    hint: "",
    color: "#7b8496",
    bg: "#f0f3f7",
  };
}

export function getStatusColor(status, slaBreached = false) {
  return resolveStatusUI(status, slaBreached).color;
}
