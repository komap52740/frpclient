import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";
import { getLockTypeLabel } from "../../constants/labels";

const CREATE_DEFAULTS_KEY = "frp_create_defaults_v1";
const RUSTDESK_ID_MIN_LEN = 8;
const RUSTDESK_ID_MAX_LEN = 12;
const RU_DESKTOP_DOWNLOAD_URL = "https://rudesktop.ru/downloads/";

function splitDevice(rawDevice) {
  const normalized = (rawDevice || "").trim().replace(/\s+/g, " ");
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
    return "Код доступа слишком короткий (минимум 4 символа)";
  }
  return "";
}

function buildAutoTemplate({ device, lockType, hasPc }) {
  const normalizedDevice = (device || "").trim() || "не указано";
  return [
    "Нужна удаленная разблокировка.",
    `Устройство: ${normalizedDevice}.`,
    `Тип блокировки: ${getLockTypeLabel(lockType)}.`,
    `Доступ к ПК: ${hasPc ? "есть" : "нет"}.`,
  ].join(" ");
}

export default function CreateAppointmentPage() {
  const navigate = useNavigate();
  const storedDefaults = useMemo(() => readStoredDefaults(), []);

  const [form, setForm] = useState({
    device: "",
    lock_type: storedDefaults.lock_type || "OTHER",
    has_pc: storedDefaults.has_pc ?? true,
    description: "",
    rustdesk_id: storedDefaults.rustdesk_id || "",
    rustdesk_password: storedDefaults.rustdesk_password || "",
    photo_lock_screen: null,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ruInputsUnlocked, setRuInputsUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({
    device: false,
    rustdesk_id: false,
    rustdesk_password: false,
  });

  const hasStoredAccess = Boolean(storedDefaults.rustdesk_id || storedDefaults.rustdesk_password);

  const autoTemplate = useMemo(
    () =>
      buildAutoTemplate({
        device: form.device,
        lockType: form.lock_type,
        hasPc: form.has_pc,
      }),
    [form.device, form.has_pc, form.lock_type]
  );

  const deviceError = useMemo(() => {
    const { brand, model } = splitDevice(form.device);
    return !brand || !model ? "Укажите устройство (марка и модель)" : "";
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

  const progressValue = useMemo(() => {
    let score = 1;
    if (normalizeRustdeskId(form.rustdesk_id) && !rustdeskIdError) score += 0.5;
    if (form.rustdesk_password.trim() && !rustdeskPasswordError) score += 0.5;
    return Math.round((score / 2) * 100);
  }, [form.rustdesk_id, form.rustdesk_password, rustdeskIdError, rustdeskPasswordError]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) {
      setError("");
    }
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
    const note = form.description.trim();
    const description = note ? `${autoTemplate}\n\nКомментарий клиента: ${note}` : autoTemplate;

    const payload = new FormData();
    payload.append("brand", brand);
    payload.append("model", model);
    payload.append("lock_type", form.lock_type);
    payload.append("has_pc", String(form.has_pc));
    payload.append("description", description);

    const normalizedId = normalizeRustdeskId(form.rustdesk_id);
    const normalizedPassword = form.rustdesk_password.trim();
    if (normalizedId) {
      payload.append("rustdesk_id", normalizedId);
    }
    if (normalizedPassword) {
      payload.append("rustdesk_password", normalizedPassword);
    }

    if (form.photo_lock_screen) {
      payload.append("photo_lock_screen", form.photo_lock_screen);
    }

    try {
      const response = await appointmentsApi.create(payload);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          CREATE_DEFAULTS_KEY,
          JSON.stringify({
            rustdesk_id: normalizedId,
            rustdesk_password: normalizedPassword,
            lock_type: form.lock_type,
            has_pc: form.has_pc,
          })
        );
      }
      navigate(`/appointments/${response.data.id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Не удалось создать заявку");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2.4, md: 3.2 }, borderRadius: 1.8 }}>
      <Stack spacing={0.8} sx={{ mb: 2 }}>
        <Typography variant="h5">Новая заявка</Typography>
        <Typography variant="body2" color="text.secondary">
          Минимум действий: укажите устройство и отправьте заявку. Данные RuDesktop можно добавить позже.
        </Typography>

        <Alert
          severity="info"
          action={(
            <Button size="small" color="inherit" href={RU_DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              Скачать RuDesktop
            </Button>
          )}
        >
          RuDesktop нужен для удалённого доступа к вашему ПК. Если программа не готова сейчас, просто добавите ID и код позже в карточке заявки или в чате.
        </Alert>

        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          <Chip size="small" color="success" label="1. Устройство (обязательно)" variant="filled" />
          <Chip size="small" color={normalizeRustdeskId(form.rustdesk_id) ? "success" : "default"} label="2. ID RuDesktop (опц.)" variant={normalizeRustdeskId(form.rustdesk_id) ? "filled" : "outlined"} />
          <Chip size="small" color={form.rustdesk_password.trim() ? "success" : "default"} label="3. Код доступа (опц.)" variant={form.rustdesk_password.trim() ? "filled" : "outlined"} />
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Готовность: {progressValue}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressValue}
            color={progressValue >= 75 ? "success" : "primary"}
            sx={{ borderRadius: 1, height: 6 }}
          />
        </Stack>
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
          label="Устройство"
          placeholder="Например: Samsung A54"
          value={form.device}
          onChange={(event) => updateField("device", event.target.value)}
          onBlur={() => markTouched("device")}
          error={showDeviceError}
          helperText={showDeviceError ? deviceError : "Марка и модель устройства"}
          required
        />

        <TextField
          label="ID RuDesktop"
          placeholder="Например: 123456789"
          value={form.rustdesk_id}
          onChange={(event) => updateField("rustdesk_id", event.target.value.replace(/[^\d\s-]/g, ""))}
          onBlur={() => markTouched("rustdesk_id")}
          onFocus={unlockRuInputs}
          onPointerDown={unlockRuInputs}
          error={showRustdeskIdError}
          color={form.rustdesk_id && !rustdeskIdError ? "success" : "primary"}
          helperText={
            showRustdeskIdError
              ? rustdeskIdError
              : form.rustdesk_id && !rustdeskIdError
                ? "ID выглядит корректно"
                : "Опционально: можно добавить позже"
          }
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
          label="Код доступа RuDesktop"
          type="text"
          value={form.rustdesk_password}
          onChange={(event) => updateField("rustdesk_password", event.target.value)}
          onBlur={() => markTouched("rustdesk_password")}
          onFocus={unlockRuInputs}
          onPointerDown={unlockRuInputs}
          error={showRustdeskPasswordError}
          color={form.rustdesk_password && !rustdeskPasswordError ? "success" : "primary"}
          helperText={
            showRustdeskPasswordError
              ? rustdeskPasswordError
              : form.rustdesk_password && !rustdeskPasswordError
                ? "Код доступа выглядит корректно"
                : "Опционально: динамический код из RuDesktop"
          }
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

        <Typography variant="caption" color="text.secondary">
          Автошаблон добавится автоматически. Длинное описание писать не нужно.
        </Typography>

        <Button
          variant={showAdvanced ? "outlined" : "text"}
          onClick={() => setShowAdvanced((prev) => !prev)}
          sx={{ alignSelf: "flex-start" }}
        >
          {showAdvanced ? "Скрыть доп. поля" : "Доп. поля (опционально)"}
        </Button>

        {showAdvanced ? (
          <Stack spacing={1.2}>
            <TextField
              select
              label="Тип блокировки"
              value={form.lock_type}
              onChange={(event) => updateField("lock_type", event.target.value)}
            >
              {["PIN", "GOOGLE", "APPLE_ID", "OTHER"].map((type) => (
                <MenuItem key={type} value={type}>
                  {getLockTypeLabel(type)}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={<Switch checked={form.has_pc} onChange={(event) => updateField("has_pc", event.target.checked)} />}
              label="Есть доступ к ПК"
            />

            <TextField
              label="Комментарий (опционально)"
              placeholder="Любые уточнения для мастера"
              multiline
              minRows={2}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />

            <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}>
              Фото экрана блокировки (опционально)
              <input
                hidden
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(event) => updateField("photo_lock_screen", event.target.files?.[0] || null)}
              />
            </Button>
          </Stack>
        ) : null}

        <Box
          sx={{
            position: { xs: "sticky", md: "static" },
            bottom: { xs: 8, md: "auto" },
            zIndex: 2,
            pt: 0.4,
          }}
        >
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={!canSubmit}
            startIcon={<LockOpenRoundedIcon />}
            sx={{ minHeight: 52, borderRadius: 1.4, fontWeight: 800 }}
          >
            {submitting ? "Отправляем заявку..." : "Создать заявку"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
