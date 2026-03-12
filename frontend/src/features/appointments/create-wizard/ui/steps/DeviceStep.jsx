import {
  Alert,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { LOCK_TYPE_OPTIONS } from "../../model/schema";

export default function DeviceStep({ form, errors, touched, updateField, markTouched }) {
  return (
    <Stack spacing={1.6}>
      <Stack spacing={0.4}>
        <Typography variant="h6">Шаг 1. Устройство и контекст</Typography>
        <Typography variant="body2" color="text.secondary">
          На этом шаге фиксируем устройство, тип блокировки и базовую готовность к удаленному
          подключению.
        </Typography>
      </Stack>

      {!form.has_pc ? (
        <Alert severity="warning">
          Для удаленной разблокировки нужен ПК или ноутбук с интернетом. Без этого мастер не сможет
          начать работу.
        </Alert>
      ) : (
        <Alert severity="info">
          Чем точнее указаны бренд, модель и тип блокировки, тем быстрее мастер поймет сценарий.
        </Alert>
      )}

      <Grid container spacing={1.2}>
        <Grid item xs={12} md={5}>
          <TextField
            fullWidth
            required
            label="Бренд"
            placeholder="Например: Samsung"
            value={form.brand}
            onChange={(event) => updateField("brand", event.target.value)}
            onBlur={() => markTouched("brand")}
            error={touched.brand && Boolean(errors.brand)}
            slotProps={{ htmlInput: { "data-testid": "appointment-wizard-brand" } }}
            helperText={touched.brand && errors.brand ? errors.brand : "Название бренда устройства"}
          />
        </Grid>
        <Grid item xs={12} md={7}>
          <TextField
            fullWidth
            required
            label="Модель"
            placeholder="Например: Galaxy A54"
            value={form.model}
            onChange={(event) => updateField("model", event.target.value)}
            onBlur={() => markTouched("model")}
            error={touched.model && Boolean(errors.model)}
            slotProps={{ htmlInput: { "data-testid": "appointment-wizard-model" } }}
            helperText={
              touched.model && errors.model ? errors.model : "Как указано на устройстве или коробке"
            }
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Тип блокировки"
            value={form.lock_type}
            onChange={(event) => updateField("lock_type", event.target.value)}
            SelectProps={{ "data-testid": "appointment-wizard-lock-type" }}
          >
            {LOCK_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <FormControlLabel
        control={
          <Switch
            checked={form.has_pc}
            onChange={(event) => updateField("has_pc", event.target.checked)}
            inputProps={{ "data-testid": "appointment-wizard-has-pc" }}
          />
        }
        label="У меня есть ПК или ноутбук с интернетом для удаленного подключения"
      />
    </Stack>
  );
}
