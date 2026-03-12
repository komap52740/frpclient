export const B2B_STATUS_META = {
  none: {
    label: "Не подключён",
    detailedLabel: "Анкета не подана",
    chipColor: "default",
    chipVariant: "outlined",
    guidance:
      "Запрос на партнёрский доступ ещё не отправлен. Заполните карточку компании в основном профиле, чтобы запустить модерацию.",
  },
  pending: {
    label: "На проверке",
    detailedLabel: "Анкета на проверке",
    chipColor: "warning",
    chipVariant: "outlined",
    guidance:
      "Анкета уже в модерации. После проверки статус обновится автоматически, а компания появится в подтверждённом B2B-контуре.",
  },
  approved: {
    label: "Подтверждён",
    detailedLabel: "B2B подтверждён",
    chipColor: "success",
    chipVariant: "filled",
    guidance:
      "Компания подтверждена. Заявки обрабатываются как партнёрские, а приоритет и SLA применяются по B2B-правилам.",
  },
  rejected: {
    label: "Отклонён",
    detailedLabel: "B2B отклонён",
    chipColor: "error",
    chipVariant: "outlined",
    guidance:
      "Модерация отклонила анкету. Исправьте реквизиты и фотографии сервисной зоны в основном профиле и отправьте запрос повторно.",
  },
};

export const B2B_PRIORITY_META = {
  standard: { label: "Стандарт", chipColor: "default", chipVariant: "outlined" },
  priority: { label: "Приоритет", chipColor: "primary", chipVariant: "filled" },
  critical: { label: "Критический", chipColor: "error", chipVariant: "filled" },
};

export function getB2BStatusMeta(status = "none") {
  return B2B_STATUS_META[status] || B2B_STATUS_META.none;
}

export function getB2BPriorityMeta(priority = "standard") {
  return B2B_PRIORITY_META[priority] || B2B_PRIORITY_META.standard;
}

export function presentB2BValue(value, fallback = "Не указано") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

export function rewriteLegacyB2BNotification(title, message) {
  const titleText = String(title || "").trim();
  const messageText = String(message || "").trim();
  const combined = `${titleText} ${messageText}`.toLowerCase();

  if (!combined.includes("оптов") && !combined.includes("service center")) {
    return { title: titleText, message: messageText };
  }

  if (
    !combined.includes("статус") &&
    !combined.includes("скид") &&
    !combined.includes("одобр") &&
    !combined.includes("отклон")
  ) {
    return { title: titleText, message: messageText };
  }

  if (combined.includes("отклон")) {
    return {
      title: "Решение по B2B-статусу",
      message:
        "B2B-статус отклонён. Проверьте реквизиты компании и уточните детали у партнёрской поддержки.",
    };
  }

  return {
    title: "Решение по B2B-статусу",
    message: "B2B-статус подтверждён. Аккаунт переведён в партнёрский режим обслуживания.",
  };
}
