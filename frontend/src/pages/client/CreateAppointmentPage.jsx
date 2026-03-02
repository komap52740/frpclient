import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Alert,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
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
import { useAuth } from "../../auth/AuthContext";
import { getLockTypeLabel } from "../../constants/labels";

const CREATE_DEFAULTS_KEY = "frp_create_defaults_v1";
const RUSTDESK_ID_MIN_LEN = 8;
const RUSTDESK_ID_MAX_LEN = 12;

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
  if (!value) {
    return "Укажите ID RuDesktop";
  }
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
  if (!value) {
    return "Укажите код доступа RuDesktop";
  }
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
  const { user } = useAuth();
  const storedDefaults = useMemo(() => readStoredDefaults(), []);

  const [form, setForm] = useState({
    device: "",
    lock_type: storedDefaults.lock_type || "OTHER",
    has_pc: storedDefaults.has_pc ?? true,
    description: "",
    rustdesk_id: storedDefaults.rustdesk_id || "",
    rustdesk_password: storedDefaults.rustdesk_password || "",
    photo_lock_screen: null,
    is_wholesale_request: false,
    is_service_center: false,
    wholesale_company_name: user?.wholesale_company_name || "",
    wholesale_comment: user?.wholesale_comment || "",
    wholesale_service_details: user?.wholesale_service_details || "",
    wholesale_service_photo_1: null,
    wholesale_service_photo_2: null,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({
    device: false,
    rustdesk_id: false,
    rustdesk_password: false,
  });

  const hasStoredAccess = Boolean(storedDefaults.rustdesk_id || storedDefaults.rustdesk_password);
  const wholesaleStatus = user?.wholesale_status || "none";
  const wholesaleDiscount = Number(user?.wholesale_discount_percent || 0);
  const hasExistingWholesalePhoto = Boolean(
    user?.wholesale_service_photo_1_url || user?.wholesale_service_photo_2_url
  );

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
  const wholesaleCompanyError = useMemo(() => {
    if (!form.is_wholesale_request) {
      return "";
    }
    return form.wholesale_company_name.trim() ? "" : "Укажите название сервисного центра";
  }, [form.is_wholesale_request, form.wholesale_company_name]);
  const wholesaleDetailsError = useMemo(() => {
    if (!form.is_wholesale_request) {
      return "";
    }
    return form.wholesale_service_details.trim().length >= 20
      ? ""
      : "Опишите сервис минимум в 20 символах";
  }, [form.is_wholesale_request, form.wholesale_service_details]);
  const wholesalePhotoError = useMemo(() => {
    if (!form.is_wholesale_request) {
      return "";
    }
    return form.wholesale_service_photo_1 || form.wholesale_service_photo_2 || hasExistingWholesalePhoto
      ? ""
      : "Добавьте хотя бы одно фото сервиса";
  }, [
    form.is_wholesale_request,
    form.wholesale_service_photo_1,
    form.wholesale_service_photo_2,
    hasExistingWholesalePhoto,
  ]);

  const showDeviceError = touched.device && Boolean(deviceError);
  const showRustdeskIdError = touched.rustdesk_id && Boolean(rustdeskIdError);
  const showRustdeskPasswordError = touched.rustdesk_password && Boolean(rustdeskPasswordError);

  const canSubmit =
    !submitting &&
    !deviceError &&
    !rustdeskIdError &&
    !rustdeskPasswordError &&
    !wholesaleCompanyError &&
    !wholesaleDetailsError &&
    !wholesalePhotoError;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) {
      setError("");
    }
  };

  const markTouched = (key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setTouched({
      device: true,
      rustdesk_id: true,
      rustdesk_password: true,
    });

    if (
      deviceError ||
      rustdeskIdError ||
      rustdeskPasswordError ||
      wholesaleCompanyError ||
      wholesaleDetailsError ||
      wholesalePhotoError
    ) {
      setError(
        deviceError ||
          rustdeskIdError ||
          rustdeskPasswordError ||
          wholesaleCompanyError ||
          wholesaleDetailsError ||
          wholesalePhotoError
      );
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
    payload.append("rustdesk_id", normalizeRustdeskId(form.rustdesk_id));
    payload.append("rustdesk_password", form.rustdesk_password.trim());
    payload.append("is_wholesale_request", String(Boolean(form.is_wholesale_request)));
    payload.append("is_service_center", String(Boolean(form.is_service_center)));
    if (form.wholesale_company_name.trim()) {
      payload.append("wholesale_company_name", form.wholesale_company_name.trim());
    }
    if (form.wholesale_comment.trim()) {
      payload.append("wholesale_comment", form.wholesale_comment.trim());
    }
    if (form.wholesale_service_details.trim()) {
      payload.append("wholesale_service_details", form.wholesale_service_details.trim());
    }
    if (form.wholesale_service_photo_1) {
      payload.append("wholesale_service_photo_1", form.wholesale_service_photo_1);
    }
    if (form.wholesale_service_photo_2) {
      payload.append("wholesale_service_photo_2", form.wholesale_service_photo_2);
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
            rustdesk_id: normalizeRustdeskId(form.rustdesk_id),
            rustdesk_password: form.rustdesk_password.trim(),
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
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3.2 }}>
      <Stack spacing={0.7} sx={{ mb: 2 }}>
        <Typography variant="h5">Новая заявка</Typography>
        <Typography variant="body2" color="text.secondary">
          Быстрый режим: заполните 3 поля и отправьте. Остальное добавится автоматически.
        </Typography>
      </Stack>

      {hasStoredAccess ? (
        <Alert severity="info" sx={{ mb: 1.4 }}>
          Данные RuDesktop подставлены из последней заявки. Проверьте их перед отправкой.
        </Alert>
      ) : null}
      {wholesaleStatus === "pending" ? (
        <Alert severity="warning" sx={{ mb: 1.4 }}>
          Ваша оптовая заявка уже на рассмотрении. До одобрения цена выставляется без скидки.
        </Alert>
      ) : null}
      {wholesaleStatus === "approved" ? (
        <Alert severity="success" sx={{ mb: 1.4 }}>
          Оптовая скидка одобрена: {wholesaleDiscount}%. При оптовой заявке скидка применяется автоматически.
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 1.4 }}>
          {error}
        </Alert>
      ) : null}

      <Stack component="form" spacing={1.3} onSubmit={onSubmit} autoComplete="off" noValidate>
        {/* Trap browser credential autofill so it does not pollute RuDesktop fields. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0 }}
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0 }}
        />

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
          onChange={(event) => updateField("rustdesk_id", event.target.value)}
          onBlur={() => markTouched("rustdesk_id")}
          error={showRustdeskIdError}
          color={form.rustdesk_id && !rustdeskIdError ? "success" : "primary"}
          helperText={
            showRustdeskIdError
              ? rustdeskIdError
              : form.rustdesk_id && !rustdeskIdError
                ? "ID выглядит корректно"
                : "ID устройства для подключения мастера"
          }
          required
          autoComplete="off"
          inputProps={{
            autoComplete: "off",
            name: "rustdesk_remote_id",
            inputMode: "numeric",
            "data-lpignore": "true",
            "data-1p-ignore": "true",
          }}
        />

        <TextField
          label="Код доступа RuDesktop"
          type={showPassword ? "text" : "password"}
          value={form.rustdesk_password}
          onChange={(event) => updateField("rustdesk_password", event.target.value)}
          onBlur={() => markTouched("rustdesk_password")}
          error={showRustdeskPasswordError}
          color={form.rustdesk_password && !rustdeskPasswordError ? "success" : "primary"}
          helperText={
            showRustdeskPasswordError
              ? rustdeskPasswordError
              : form.rustdesk_password && !rustdeskPasswordError
                ? "Код доступа выглядит корректно"
                : "Код доступа из RuDesktop для подключения мастера"
          }
          required
          autoComplete="new-password"
          inputProps={{
            autoComplete: "new-password",
            name: "rustdesk_access_code",
            "data-lpignore": "true",
            "data-1p-ignore": "true",
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton edge="end" onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Alert severity="info">Автошаблон заявки: {autoTemplate}</Alert>

        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2.1 }}>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_wholesale_request}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateField("is_wholesale_request", checked);
                    updateField("is_service_center", checked);
                  }}
                />
              }
              label="Оптовая заявка для сервисного центра"
            />
            {form.is_wholesale_request ? (
              <Stack spacing={1}>
                <TextField
                  label="Название сервиса"
                  placeholder="Например: ServiceHub Москва"
                  value={form.wholesale_company_name}
                  onChange={(event) => updateField("wholesale_company_name", event.target.value)}
                  error={Boolean(wholesaleCompanyError)}
                  helperText={
                    wholesaleCompanyError || "По этой заявке будет отправлен запрос на оптовую скидку"
                  }
                  required
                />
                <TextField
                  label="Комментарий для одобрения (опционально)"
                  placeholder="Сколько заявок в месяц, город, условия"
                  value={form.wholesale_comment}
                  onChange={(event) => updateField("wholesale_comment", event.target.value)}
                  multiline
                  minRows={2}
                />
                <TextField
                  label="Описание сервиса"
                  placeholder="Какие устройства обслуживаете, объём заявок, специализация"
                  value={form.wholesale_service_details}
                  onChange={(event) => updateField("wholesale_service_details", event.target.value)}
                  error={Boolean(wholesaleDetailsError)}
                  helperText={wholesaleDetailsError || "Минимум 20 символов"}
                  multiline
                  minRows={3}
                  required
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}
                  >
                    Фото сервиса 1 (обязательно)
                    <input
                      hidden
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(event) => updateField("wholesale_service_photo_1", event.target.files?.[0] || null)}
                    />
                  </Button>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}
                  >
                    Фото сервиса 2 (опционально)
                    <input
                      hidden
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(event) => updateField("wholesale_service_photo_2", event.target.files?.[0] || null)}
                    />
                  </Button>
                </Stack>
                {form.wholesale_service_photo_1 ? (
                  <Typography variant="caption" color="text.secondary">
                    Фото 1: {form.wholesale_service_photo_1.name}
                  </Typography>
                ) : null}
                {form.wholesale_service_photo_2 ? (
                  <Typography variant="caption" color="text.secondary">
                    Фото 2: {form.wholesale_service_photo_2.name}
                  </Typography>
                ) : null}
                {hasExistingWholesalePhoto && !form.wholesale_service_photo_1 && !form.wholesale_service_photo_2 ? (
                  <Typography variant="caption" color="text.secondary">
                    Фото сервиса уже сохранены в профиле, можно отправить заявку без повторной загрузки.
                  </Typography>
                ) : null}
                {wholesalePhotoError ? (
                  <Typography variant="caption" color="error.main">
                    {wholesalePhotoError}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Форматы: jpg/jpeg/png/webp, до 10 МБ
                  </Typography>
                )}
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Оптовая скидка начнет применяться после одобрения администратором.
                </Alert>
              </Stack>
            ) : null}
          </Stack>
        </Paper>

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

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!canSubmit}
          startIcon={<LockOpenRoundedIcon />}
          sx={{ minHeight: 50, borderRadius: 2.4, fontWeight: 800 }}
        >
          {submitting ? "Отправляем заявку..." : "Создать заявку"}
        </Button>
      </Stack>
    </Paper>
  );
}
