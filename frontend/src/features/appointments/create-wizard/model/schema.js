import { LOCK_TYPE_LABELS } from "../../../../constants/labels";

export const RUSTDESK_ID_MIN_LEN = 8;
export const RUSTDESK_ID_MAX_LEN = 12;
export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const WIZARD_STEPS = [
  {
    key: "device",
    title: "Устройство",
    description: "Модель, тип блокировки и доступность ПК",
  },
  {
    key: "access",
    title: "Доступ",
    description: "RuDesktop, описание и фото блокировки",
  },
  {
    key: "review",
    title: "Проверка",
    description: "Итоговая сводка перед отправкой",
  },
];

export const STEP_FIELDS = {
  0: ["brand", "model", "has_pc"],
  1: ["rustdesk_id", "rustdesk_password", "photo_lock_screen"],
  2: [],
};

export const LOCK_TYPE_OPTIONS = [
  { value: "GOOGLE", label: LOCK_TYPE_LABELS.GOOGLE },
  { value: "HUAWEI_ID", label: LOCK_TYPE_LABELS.HUAWEI_ID },
  { value: "MI_ACC", label: LOCK_TYPE_LABELS.MI_ACC },
  { value: "OTHER", label: LOCK_TYPE_LABELS.OTHER },
];

export function normalizeRustdeskId(raw) {
  return String(raw || "")
    .replace(/[\s-]+/g, "")
    .trim();
}

export function getEmptyAppointmentWizardForm(defaults = {}) {
  return {
    brand: "",
    model: "",
    lock_type: "OTHER",
    has_pc: true,
    description: "",
    rustdesk_id: defaults.rustdesk_id || "",
    rustdesk_password: defaults.rustdesk_password || "",
    photo_lock_screen: null,
  };
}

export function validateBrand(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Укажите бренд устройства";
  }
  if (normalized.length < 2) {
    return "Бренд слишком короткий";
  }
  return "";
}

export function validateModel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Укажите модель устройства";
  }
  if (normalized.length < 2) {
    return "Модель слишком короткая";
  }
  return "";
}

export function validateHasPc(value) {
  return value ? "" : "Для удаленной разблокировки нужен ПК или ноутбук с интернетом";
}

export function validateRustdeskId(raw) {
  const value = normalizeRustdeskId(raw);
  if (!value) return "";
  if (!/^\d+$/.test(value)) {
    return "ID RuDesktop должен содержать только цифры";
  }
  if (value.length < RUSTDESK_ID_MIN_LEN || value.length > RUSTDESK_ID_MAX_LEN) {
    return `ID должен быть от ${RUSTDESK_ID_MIN_LEN} до ${RUSTDESK_ID_MAX_LEN} цифр`;
  }
  return "";
}

export function validateRustdeskPassword(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.length < 4) {
    return "Пароль RuDesktop слишком короткий (минимум 4 символа)";
  }
  return "";
}

export function validatePhotoLockScreen(file) {
  if (!file) {
    return "";
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["jpg", "jpeg", "png"].includes(ext)) {
    return "Фото экрана должно быть в формате jpg, jpeg или png";
  }
  if (file.size > PHOTO_MAX_SIZE_BYTES) {
    return "Фото экрана не должно превышать 10 МБ";
  }
  return "";
}

export function getAppointmentWizardErrors(form) {
  return {
    brand: validateBrand(form.brand),
    model: validateModel(form.model),
    has_pc: validateHasPc(form.has_pc),
    rustdesk_id: validateRustdeskId(form.rustdesk_id),
    rustdesk_password: validateRustdeskPassword(form.rustdesk_password),
    photo_lock_screen: validatePhotoLockScreen(form.photo_lock_screen),
  };
}

export function hasStepErrors(errors, stepIndex) {
  const fields = STEP_FIELDS[stepIndex] || [];
  return fields.some((field) => Boolean(errors[field]));
}

export function findFirstInvalidStep(errors) {
  for (let index = 0; index < WIZARD_STEPS.length; index += 1) {
    if (hasStepErrors(errors, index)) {
      return index;
    }
  }
  return -1;
}

export function buildCreateAppointmentPayload(form) {
  const payload = new FormData();
  payload.append("brand", String(form.brand || "").trim());
  payload.append("model", String(form.model || "").trim());
  payload.append("lock_type", form.lock_type || "OTHER");
  payload.append("has_pc", form.has_pc ? "true" : "false");
  payload.append(
    "description",
    (form.description || "").trim() || "Нужна удаленная разблокировка устройства."
  );

  const rustdeskId = normalizeRustdeskId(form.rustdesk_id);
  const rustdeskPassword = String(form.rustdesk_password || "").trim();

  if (rustdeskId) payload.append("rustdesk_id", rustdeskId);
  if (rustdeskPassword) payload.append("rustdesk_password", rustdeskPassword);
  if (form.photo_lock_screen) payload.append("photo_lock_screen", form.photo_lock_screen);

  return payload;
}

export function estimateAppointmentTiming(form) {
  let responseMinutes = 18;
  let completionMinutes = 55;

  if (form.has_pc) {
    responseMinutes -= 3;
    completionMinutes -= 5;
  } else {
    responseMinutes += 20;
    completionMinutes += 30;
  }

  if (normalizeRustdeskId(form.rustdesk_id) && String(form.rustdesk_password || "").trim()) {
    responseMinutes -= 4;
    completionMinutes -= 10;
  } else {
    responseMinutes += 8;
    completionMinutes += 12;
  }

  if (form.photo_lock_screen) {
    responseMinutes -= 3;
  } else {
    responseMinutes += 5;
  }

  if (String(form.description || "").trim().length >= 40) {
    responseMinutes -= 2;
    completionMinutes -= 5;
  }

  if (form.lock_type === "GOOGLE") {
    completionMinutes += 10;
  }
  if (form.lock_type === "HUAWEI_ID") {
    completionMinutes += 14;
  }
  if (form.lock_type === "MI_ACC") {
    completionMinutes += 20;
  }

  responseMinutes = Math.max(5, responseMinutes);
  completionMinutes = Math.max(20, completionMinutes);

  const confidence =
    form.has_pc &&
    normalizeRustdeskId(form.rustdesk_id) &&
    String(form.rustdesk_password || "").trim() &&
    form.photo_lock_screen
      ? "Высокая"
      : "Средняя";

  return {
    responseMinutes,
    completionMinutes,
    confidence,
  };
}
