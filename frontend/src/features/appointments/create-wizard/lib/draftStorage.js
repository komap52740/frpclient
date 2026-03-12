const CREATE_DEFAULTS_KEY = "frp_create_defaults_v2";
const CREATE_DRAFT_KEY = "frp_create_appointment_wizard_draft_v1";

function readJson(key) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors; form still works in-memory.
  }
}

export function readCreateDefaults() {
  return readJson(CREATE_DEFAULTS_KEY) || {};
}

export function writeCreateDefaults(defaults) {
  writeJson(CREATE_DEFAULTS_KEY, defaults);
}

export function readCreateDraft() {
  const draft = readJson(CREATE_DRAFT_KEY) || {};
  return {
    currentStep: Number.isInteger(draft.currentStep) ? draft.currentStep : 0,
    form: draft.form || {},
    meta: draft.meta || {},
  };
}

export function writeCreateDraft({ currentStep, form }) {
  const hadPhoto = Boolean(form.photo_lock_screen);
  writeJson(CREATE_DRAFT_KEY, {
    currentStep,
    form: {
      brand: form.brand || "",
      model: form.model || "",
      lock_type: form.lock_type || "OTHER",
      has_pc: Boolean(form.has_pc),
      description: form.description || "",
      rustdesk_id: form.rustdesk_id || "",
      rustdesk_password: form.rustdesk_password || "",
    },
    meta: {
      hadPhotoLockScreen: hadPhoto,
      photoLockScreenName: hadPhoto ? form.photo_lock_screen.name : "",
      updatedAt: new Date().toISOString(),
    },
  });
}

export function clearCreateDraft() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CREATE_DRAFT_KEY);
}
