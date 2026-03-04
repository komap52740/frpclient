import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";

const CREATE_DEFAULTS_KEY = "frp_create_defaults_v2";
const RUSTDESK_ID_MIN_LEN = 8;
const RUSTDESK_ID_MAX_LEN = 12;
const RU_DESKTOP_DOWNLOAD_URL = "https://rudesktop.ru/downloads/";

function splitDevice(rawDevice) {
  const normalized = String(rawDevice || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { brand: "", model: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { brand: normalized, model: normalized };
  }

  return {
    brand: parts[0],
    model: parts.slice(1).join(" "),
  };
}

function readStoredDefaults() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CREATE_DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeRustdeskId(raw) {
  return String(raw || "").replace(/[\s-]+/g, "").trim();
}

function validateRustdeskId(raw) {
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

function validateRustdeskPassword(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.length < 4) {
    return "Пароль RuDesktop слишком короткий (минимум 4 символа)";
  }
  return "";
}

export default function CreateAppointmentPage() {
  const navigate = useNavigate();
  const storedDefaults = useMemo(() => readStoredDefaults(), []);

  const [form, setForm] = useState({
    device: "",
    description: "",
    rustdesk_id: storedDefaults.rustdesk_id || "",
    rustdesk_password: storedDefaults.rustdesk_password || "",
    photo_lock_screen: null,
  });
  const [ruInputsUnlocked, setRuInputsUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({
    device: false,
    rustdesk_id: false,
    rustdesk_password: false,
  });

  const hasStoredAccess = Boolean(storedDefaults.rustdesk_id || storedDefaults.rustdesk_password);

  const deviceError = useMemo(() => {
    const normalized = String(form.device || "").trim();
    if (!normalized) return "Укажите модель устройства";
    return normalized.length < 2 ? "Модель слишком короткая" : "";
  }, [form.device]);

  const rustdeskIdError = useMemo(() => validateRustdeskId(form.rustdesk_id), [form.rustdesk_id]);
  const rustdeskPasswordError = useMemo(
    () => validateRustdeskPassword(form.rustdesk_password),
    [form.rustdesk_password]
  );

  const showDeviceError = touched.device && Boolean(deviceError);
  const showRustdeskIdError = touched.rustdesk_id && Boolean(rustdeskIdError);
  const showRustdeskPasswordError = touched.rustdesk_password && Boolean(rustdeskPasswordError);
  const canSubmit = !submitting && !deviceError && !rustdeskIdError && !rustdeskPasswordError;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  const markTouched = (key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const unlockRuInputs = () => {
    if (!ruInputsUnlocked) {
      setRuInputsUnlocked(true);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setTouched({
      device: true,
      rustdesk_id: Boolean(form.rustdesk_id),
      rustdesk_password: Boolean(form.rustdesk_password),
    });

    if (deviceError || rustdeskIdError || rustdeskPasswordError) {
      setError(deviceError || rustdeskIdError || rustdeskPasswordError);
      setSubmitting(false);
      return;
    }

    const { brand, model } = splitDevice(form.device);
    const description = form.description.trim() || "Нужна удаленная разблокировка устройства.";

    const payload = new FormData();
    payload.append("brand", brand || "Устройство");
    payload.append("model", model || form.device.trim());
    payload.append("lock_type", "OTHER");
    payload.append("has_pc", "true");
    payload.append("description", description);

    const normalizedId = normalizeRustdeskId(form.rustdesk_id);
    const normalizedPassword = form.rustdesk_password.trim();
    if (normalizedId) payload.append("rustdesk_id", normalizedId);
    if (normalizedPassword) payload.append("rustdesk_password", normalizedPassword);
    if (form.photo_lock_screen) payload.append("photo_lock_screen", form.photo_lock_screen);

    try {
      const response = await appointmentsApi.create(payload);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          CREATE_DEFAULTS_KEY,
          JSON.stringify({
            rustdesk_id: normalizedId,
            rustdesk_password: normalizedPassword,
          })
        );
      }
      navigate(`/appointments/${response.data.id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Не удалось создать заявку");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2.2, md: 2.8 }, borderRadius: 1.4 }}>
      <Stack spacing={1.2} sx={{ mb: 2 }}>
        <Typography variant="h5">Новая заявка</Typography>
        <Typography variant="body2" color="text.secondary">
          Только главное: модель, RuDesktop, описание и фото.
        </Typography>

        <Alert
          severity="info"
          action={(
            <Button size="small" color="inherit" href={RU_DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              Скачать RuDesktop
            </Button>
          )}
        >
          RuDesktop нужен для удаленного доступа к вашему ПК. ID и пароль можно добавить сразу или позже в карточке заявки.
        </Alert>
      </Stack>

      {hasStoredAccess ? (
        <Alert severity="info" sx={{ mb: 1.4 }}>
          Данные RuDesktop подставлены из последней заявки. При необходимости измените их.
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 1.4 }}>
          {error}
        </Alert>
      ) : null}

      <Stack component="form" spacing={1.3} onSubmit={onSubmit} autoComplete="off" noValidate>
        <TextField
          label="Модель устройства"
          placeholder="Например: Samsung A54"
          value={form.device}
          onChange={(event) => updateField("device", event.target.value)}
          onBlur={() => markTouched("device")}
          error={showDeviceError}
          helperText={showDeviceError ? deviceError : "Напишите модель как удобно, без лишних полей"}
          required
        />

        <TextField
          label="ID RuDesktop (опционально)"
          placeholder="Например: 123456789"
          value={form.rustdesk_id}
          onChange={(event) => updateField("rustdesk_id", event.target.value.replace(/[^\d\s-]/g, ""))}
          onBlur={() => markTouched("rustdesk_id")}
          onFocus={unlockRuInputs}
          onPointerDown={unlockRuInputs}
          error={showRustdeskIdError}
          helperText={showRustdeskIdError ? rustdeskIdError : "Можно заполнить позже"}
          autoComplete="off"
          inputProps={{
            autoComplete: "off",
            name: "rd_remote_id",
            inputMode: "numeric",
            readOnly: !ruInputsUnlocked,
            spellCheck: "false",
            autoCorrect: "off",
            autoCapitalize: "off",
            "data-lpignore": "true",
            "data-1p-ignore": "true",
            "data-form-type": "other",
          }}
        />

        <TextField
          label="Пароль RuDesktop (опционально)"
          type="text"
          value={form.rustdesk_password}
          onChange={(event) => updateField("rustdesk_password", event.target.value)}
          onBlur={() => markTouched("rustdesk_password")}
          onFocus={unlockRuInputs}
          onPointerDown={unlockRuInputs}
          error={showRustdeskPasswordError}
          helperText={showRustdeskPasswordError ? rustdeskPasswordError : "Можно заполнить позже"}
          autoComplete="off"
          inputProps={{
            autoComplete: "one-time-code",
            name: "rd_dynamic_code",
            readOnly: !ruInputsUnlocked,
            spellCheck: "false",
            autoCorrect: "off",
            autoCapitalize: "off",
            "data-lpignore": "true",
            "data-1p-ignore": "true",
            "data-form-type": "other",
          }}
        />

        <TextField
          label="Проблема (тезисно, опционально)"
          placeholder="Коротко по пунктам: 1) что случилось 2) что уже пробовали 3) что сейчас на экране"
          helperText="Опишите проблему кратко и тезисно, чтобы мастер быстрее начал работу."
          multiline
          minRows={2}
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
        />

        <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}>
          {form.photo_lock_screen ? `Фото: ${form.photo_lock_screen.name}` : "Добавить фото экрана (опционально)"}
          <input
            hidden
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(event) => updateField("photo_lock_screen", event.target.files?.[0] || null)}
          />
        </Button>

        <Box sx={{ position: { xs: "sticky", md: "static" }, bottom: { xs: 8, md: "auto" }, zIndex: 2, pt: 0.4 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={!canSubmit}
            startIcon={<LockOpenRoundedIcon />}
            sx={{ minHeight: 52, borderRadius: 1.2, fontWeight: 800 }}
          >
            {submitting ? "Создаем заявку..." : "Создать заявку"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

