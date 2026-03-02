import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";
import { getLockTypeLabel } from "../../constants/labels";

const CREATE_DEFAULTS_KEY = "frp_create_defaults_v1";
const ISSUE_TEMPLATES = [
  "Забыл PIN-код",
  "Телефон просит Google-аккаунт после сброса",
  "Нужно срочно разблокировать сегодня",
];

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

export default function CreateAppointmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    const fallback = {
      device: "",
      lock_type: "OTHER",
      has_pc: true,
      description: "",
      rustdesk_id: "",
      rustdesk_password: "",
      photo_lock_screen: null,
    };

    if (typeof window === "undefined") {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(CREATE_DEFAULTS_KEY);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return {
        ...fallback,
        rustdesk_id: parsed.rustdesk_id || "",
        rustdesk_password: parsed.rustdesk_password || "",
        lock_type: parsed.lock_type || "OTHER",
        has_pc: parsed.has_pc ?? true,
      };
    } catch {
      return fallback;
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const { brand, model } = splitDevice(form.device);
    const description = form.description.trim();
    if (!brand || !model) {
      setError("Укажите устройство (марка и модель)");
      setSubmitting(false);
      return;
    }
    if (!description) {
      setError("Коротко опишите проблему");
      setSubmitting(false);
      return;
    }
    if (!form.rustdesk_id.trim()) {
      setError("Укажите логин/ID RuDesktop");
      setSubmitting(false);
      return;
    }
    if (!form.rustdesk_password.trim()) {
      setError("Укажите пароль RuDesktop");
      setSubmitting(false);
      return;
    }

    const payload = new FormData();
    payload.append("brand", brand);
    payload.append("model", model);
    payload.append("lock_type", form.lock_type);
    payload.append("has_pc", String(form.has_pc));
    payload.append("description", description);
    payload.append("rustdesk_id", form.rustdesk_id.trim());
    payload.append("rustdesk_password", form.rustdesk_password.trim());
    if (form.photo_lock_screen) {
      payload.append("photo_lock_screen", form.photo_lock_screen);
    }

    try {
      const response = await appointmentsApi.create(payload);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          CREATE_DEFAULTS_KEY,
          JSON.stringify({
            rustdesk_id: form.rustdesk_id.trim(),
            rustdesk_password: form.rustdesk_password.trim(),
            lock_type: form.lock_type,
            has_pc: form.has_pc,
          })
        );
      }
      navigate(`/appointments/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Не удалось создать заявку");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Stack spacing={0.7} sx={{ mb: 2 }}>
        <Typography variant="h5">Новая заявка</Typography>
        <Typography variant="body2" color="text.secondary">
          Минимум шагов: устройство, что случилось, RuDesktop. Остальное можно уточнить в чате.
        </Typography>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack component="form" spacing={1.4} onSubmit={onSubmit}>
        <TextField
          label="Устройство (марка + модель)"
          placeholder="Например: Samsung A54"
          value={form.device}
          onChange={(event) => updateField("device", event.target.value)}
          required
        />

        <TextField
          label="Ваш логин/ID RuDesktop"
          placeholder="Например: 123 456 789"
          value={form.rustdesk_id}
          onChange={(event) => updateField("rustdesk_id", event.target.value)}
          helperText="Без этого мастер не сможет подключиться."
          required
        />

        <TextField
          label="Пароль RuDesktop"
          value={form.rustdesk_password}
          onChange={(event) => updateField("rustdesk_password", event.target.value)}
          helperText="Укажите пароль для подключения мастера."
          required
        />

        <TextField
          label="Что случилось?"
          placeholder="Коротко опишите проблему"
          multiline
          minRows={3}
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          required
        />
        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
          {ISSUE_TEMPLATES.map((template) => (
            <Button
              key={template}
              size="small"
              variant="text"
              onClick={() =>
                updateField(
                  "description",
                  form.description.trim() ? `${form.description.trim()}\n${template}` : template
                )
              }
              sx={{ borderRadius: 999, px: 1.2 }}
            >
              {template}
            </Button>
          ))}
        </Stack>

        <Button
          variant={showAdvanced ? "outlined" : "text"}
          startIcon={<HelpOutlineRoundedIcon fontSize="small" />}
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
              control={(
                <Switch
                  checked={form.has_pc}
                  onChange={(event) => updateField("has_pc", event.target.checked)}
                />
              )}
              label="Есть доступ к ПК"
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

        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? "Создаем заявку..." : "Создать заявку"}
        </Button>
      </Stack>
    </Paper>
  );
}
