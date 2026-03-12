import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import { Alert, Button, Grid, Stack, TextField, Typography } from "@mui/material";

const RU_DESKTOP_DOWNLOAD_URL = "https://rudesktop.ru/downloads/";

export default function AccessStep({
  form,
  errors,
  touched,
  updateField,
  markTouched,
  hasStoredAccess,
  draftMeta,
  ruInputsUnlocked,
  unlockRuInputs,
}) {
  return (
    <Stack spacing={1.6}>
      <Stack spacing={0.4}>
        <Typography variant="h6">Шаг 2. Доступ и описание</Typography>
        <Typography variant="body2" color="text.secondary">
          Данные RuDesktop можно добавить сразу или позже в карточке заявки, но с ними мастер
          стартует быстрее.
        </Typography>
      </Stack>

      <Alert
        severity="info"
        action={
          <Button
            size="small"
            color="inherit"
            href={RU_DESKTOP_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
          >
            Скачать RuDesktop
          </Button>
        }
      >
        Если RuDesktop уже установлен, просто скопируйте ID и пароль из приложения. Если нет —
        скачайте его сейчас.
      </Alert>

      {hasStoredAccess ? (
        <Alert severity="info">
          Данные RuDesktop подставлены из предыдущей заявки. Если на этом устройстве другой ID или
          пароль, обновите их.
        </Alert>
      ) : null}

      {draftMeta?.hadPhotoLockScreen ? (
        <Alert severity="warning">
          Черновик восстановлен, но фото экрана блокировки не сохраняется между перезагрузками.
          Прикрепите файл заново.
        </Alert>
      ) : null}

      <Grid container spacing={1.2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="ID RuDesktop (опционально)"
            placeholder="Например: 123456789"
            value={form.rustdesk_id}
            onChange={(event) =>
              updateField("rustdesk_id", event.target.value.replace(/[^\d\s-]/g, ""))
            }
            onBlur={() => markTouched("rustdesk_id")}
            onFocus={unlockRuInputs}
            onPointerDown={unlockRuInputs}
            error={touched.rustdesk_id && Boolean(errors.rustdesk_id)}
            helperText={
              touched.rustdesk_id && errors.rustdesk_id
                ? errors.rustdesk_id
                : "Можно заполнить позже"
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
              "data-testid": "appointment-wizard-rustdesk-id",
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Пароль RuDesktop (опционально)"
            value={form.rustdesk_password}
            onChange={(event) => updateField("rustdesk_password", event.target.value)}
            onBlur={() => markTouched("rustdesk_password")}
            onFocus={unlockRuInputs}
            onPointerDown={unlockRuInputs}
            error={touched.rustdesk_password && Boolean(errors.rustdesk_password)}
            helperText={
              touched.rustdesk_password && errors.rustdesk_password
                ? errors.rustdesk_password
                : "Можно заполнить позже"
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
              "data-testid": "appointment-wizard-rustdesk-password",
            }}
          />
        </Grid>
      </Grid>

      <TextField
        label="Описание проблемы"
        placeholder="Коротко: что случилось, что уже пробовали и что сейчас на экране"
        helperText="Чем яснее тезисы, тем меньше уточняющих вопросов будет в чате."
        multiline
        minRows={4}
        value={form.description}
        onChange={(event) => updateField("description", event.target.value)}
        slotProps={{ htmlInput: { "data-testid": "appointment-wizard-description" } }}
      />

      <Button
        component="label"
        variant="outlined"
        startIcon={<AddPhotoAlternateRoundedIcon fontSize="small" />}
      >
        {form.photo_lock_screen
          ? `Фото: ${form.photo_lock_screen.name}`
          : "Добавить фото экрана блокировки (опционально)"}
        <input
          hidden
          type="file"
          accept=".jpg,.jpeg,.png"
          data-testid="appointment-wizard-photo-input"
          onChange={(event) => {
            markTouched("photo_lock_screen");
            updateField("photo_lock_screen", event.target.files?.[0] || null);
          }}
        />
      </Button>
      {touched.photo_lock_screen && errors.photo_lock_screen ? (
        <Alert severity="warning">{errors.photo_lock_screen}</Alert>
      ) : null}
    </Stack>
  );
}
