import { Alert, Button, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";

export default function CreateAppointmentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    brand: "",
    model: "",
    lock_type: "PIN",
    has_pc: true,
    description: "",
    photo_lock_screen: null,
  });
  const [error, setError] = useState("");

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
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
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" mb={2}>Новая заявка</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        <TextField label="Бренд" value={form.brand} onChange={(e) => updateField("brand", e.target.value)} required />
        <TextField label="Модель" value={form.model} onChange={(e) => updateField("model", e.target.value)} required />
        <TextField
          select
          label="Тип блокировки"
          value={form.lock_type}
          onChange={(e) => updateField("lock_type", e.target.value)}
        >
          <MenuItem value="PIN">PIN-код</MenuItem>
          <MenuItem value="GOOGLE">Google-аккаунт</MenuItem>
          <MenuItem value="APPLE_ID">Apple ID</MenuItem>
          <MenuItem value="OTHER">Другое</MenuItem>
        </TextField>
        <FormControlLabel
          control={<Switch checked={form.has_pc} onChange={(e) => updateField("has_pc", e.target.checked)} />}
          label="Есть доступ к ПК"
        />
        <TextField
          label="Описание"
          multiline
          minRows={3}
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          required
        />

        <Button component="label" variant="outlined">
          Фото экрана блокировки (опционально)
          <input hidden type="file" accept=".jpg,.jpeg,.png" onChange={(e) => updateField("photo_lock_screen", e.target.files?.[0] || null)} />
        </Button>

        <Button type="submit" variant="contained">Создать</Button>
      </Stack>
    </Paper>
  );
}
