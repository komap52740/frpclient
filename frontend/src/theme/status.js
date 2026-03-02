const STATUS_BASE = {
  NEW: {
    label: "Новая",
    stepLabel: "Заявка создана",
    hint: "Мы подбираем мастера под ваш кейс",
    color: "#2d7fe5",
    bg: "#eaf3ff",
  },
  IN_REVIEW: {
    label: "На проверке",
    stepLabel: "Мастер изучает заявку",
    hint: "Уточняем детали и готовим стоимость",
    color: "#1570a6",
    bg: "#e7f5fb",
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплату",
    stepLabel: "Ожидаем оплату",
    hint: "Оплатите и загрузите чек, чтобы ускорить работу",
    color: "#c98408",
    bg: "#fff5e5",
  },
  PAYMENT_PROOF_UPLOADED: {
    label: "Чек загружен",
    stepLabel: "Проверяем оплату",
    hint: "Проверка обычно занимает 1-5 минут",
    color: "#b8740f",
    bg: "#fff0dc",
  },
  PAID: {
    label: "Оплачено",
    stepLabel: "Оплата подтверждена",
    hint: "Мастер может сразу переходить к работе",
    color: "#0f9b74",
    bg: "#e8faf4",
  },
  IN_PROGRESS: {
    label: "В работе",
    stepLabel: "Работа выполняется",
    hint: "Следите за прогрессом в чате и ленте событий",
    color: "#1f6bb4",
    bg: "#eaf2fb",
  },
  COMPLETED: {
    label: "Завершено",
    stepLabel: "Готово",
    hint: "Проверьте результат и оставьте короткий отзыв",
    color: "#188f55",
    bg: "#eaf8ef",
  },
  DECLINED_BY_MASTER: {
    label: "Отклонено мастером",
    stepLabel: "Заявка отклонена",
    hint: "Создайте новую заявку, если задача еще актуальна",
    color: "#c63f38",
    bg: "#fdeceb",
  },
  CANCELLED: {
    label: "Отменено",
    stepLabel: "Заявка отменена",
    hint: "Можно создать новую заявку в любой момент",
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

  return (
    STATUS_UI[status] || {
      label: status || "Неизвестно",
      stepLabel: status || "Неизвестно",
      hint: "",
      color: "#7b8496",
      bg: "#f0f3f7",
    }
  );
}

export function getStatusColor(status, slaBreached = false) {
  return resolveStatusUI(status, slaBreached).color;
}
