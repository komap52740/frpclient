import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import {
  Alert,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";

export default function CreateAppointmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    brand: "",
    model: "",
    lock_type: "OTHER",
    has_pc: true,
    description: "",
    photo_lock_screen: null,
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

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === null || value === "") return;
      payload.append(key, value);
    });

    try {
      const response = await appointmentsApi.create(payload);
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
          Заполните 3 поля. Остальное можно уточнить позже в чате.
        </Typography>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack component="form" spacing={1.4} onSubmit={onSubmit}>
        <TextField
          label="Марка"
          value={form.brand}
          onChange={(event) => updateField("brand", event.target.value)}
          required
        />
        <TextField
          label="Модель"
          value={form.model}
          onChange={(event) => updateField("model", event.target.value)}
          required
        />
        <FormControlLabel
          control={<Switch checked={form.has_pc} onChange={(event) => updateField("has_pc", event.target.checked)} />}
          label="Есть доступ к ПК"
        />
        <TextField
          label="Что случилось с телефоном?"
          placeholder="Опишите проблему простыми словами"
          multiline
          minRows={4}
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          required
        />

        <Button
          variant={showAdvanced ? "outlined" : "text"}
          startIcon={<HelpOutlineRoundedIcon fontSize="small" />}
          onClick={() => setShowAdvanced((prev) => !prev)}
          sx={{ alignSelf: "flex-start" }}
        >
          {showAdvanced ? "Скрыть доп. поля" : "Показать доп. поля"}
        </Button>

        {showAdvanced ? (
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}>
            Фото экрана блокировки (опционально)
            <input
              hidden
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(event) => updateField("photo_lock_screen", event.target.files?.[0] || null)}
            />
          </Button>
        ) : null}

        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? "Создаем заявку..." : "Создать заявку"}
        </Button>
      </Stack>
    </Paper>
  );
}
