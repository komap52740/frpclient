import {
  Button,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../../../constants/labels";

function SectionTitle({ title, subtitle }) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="h3">{title}</Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function RuleInspectorDrawer({
  open,
  onClose,
  selectedStep,
  onSelectStep,
  form,
  schema,
  selectedConditionField,
  availableOperators,
  onFieldChange,
  onCreateRule,
  onResetDraft,
  saving,
}) {
  const eventOptions = schema?.event_types || [];
  const conditionFieldOptions = schema?.condition_fields || [];
  const actionOptions = schema?.actions || [];
  const roleOptions = schema?.roles || [];
  const targetOptions = schema?.notification_targets || [];

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Stack spacing={2} sx={{ width: { xs: 360, md: 420 }, p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h2">Rule Inspector</Typography>
          <Typography variant="body2" color="text.secondary">
            Canvas задает активную секцию. Inspector меняет payload будущего правила.
          </Typography>
        </Stack>

        <ToggleButtonGroup
          exclusive
          fullWidth
          value={selectedStep}
          onChange={(_, value) => value && onSelectStep(value)}
          size="small"
        >
          <ToggleButton value="trigger">Trigger</ToggleButton>
          <ToggleButton value="condition">Condition</ToggleButton>
          <ToggleButton value="action">Action</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label="Название правила"
          value={form.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
          fullWidth
        />

        {selectedStep === "trigger" ? (
          <Stack spacing={1.2}>
            <SectionTitle title="Trigger" subtitle="Событие, которое запускает rule engine." />
            <TextField
              select
              label="Событие-триггер"
              value={form.triggerEvent}
              onChange={(event) => onFieldChange("triggerEvent", event.target.value)}
              fullWidth
            >
              {eventOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ) : null}

        {selectedStep === "condition" ? (
          <Stack spacing={1.2}>
            <SectionTitle
              title="Condition"
              subtitle="Фильтр на payload события и состояние сущности."
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={form.conditionEnabled}
                onChange={(event) => onFieldChange("conditionEnabled", event.target.checked)}
              />
              <Typography variant="body2">Включить condition node</Typography>
            </Stack>
            {form.conditionEnabled ? (
              <>
                <TextField
                  select
                  label="Поле"
                  value={form.conditionField}
                  onChange={(event) => {
                    onFieldChange("conditionField", event.target.value);
                    onFieldChange("conditionValue", "");
                  }}
                  fullWidth
                >
                  {conditionFieldOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Оператор"
                  value={form.conditionOp}
                  onChange={(event) => onFieldChange("conditionOp", event.target.value)}
                  fullWidth
                >
                  {availableOperators.map((operator) => (
                    <MenuItem key={operator.value} value={operator.value}>
                      {operator.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select={Boolean(selectedConditionField?.options?.length)}
                  label="Значение"
                  value={form.conditionValue}
                  onChange={(event) => onFieldChange("conditionValue", event.target.value)}
                  fullWidth
                  helperText={
                    form.conditionOp === "in" || form.conditionOp === "not_in"
                      ? "Для массивов перечисляйте значения через запятую."
                      : ""
                  }
                >
                  {(selectedConditionField?.options || []).map((option) => (
                    <MenuItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            ) : null}
          </Stack>
        ) : null}

        {selectedStep === "action" ? (
          <Stack spacing={1.2}>
            <SectionTitle title="Action" subtitle="Что выполняет platform layer после match." />
            <TextField
              select
              label="Действие"
              value={form.actionType}
              onChange={(event) => onFieldChange("actionType", event.target.value)}
              fullWidth
            >
              {actionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {form.actionType === "change_status" ? (
              <TextField
                select
                label="Новый статус"
                value={form.actionToStatus}
                onChange={(event) => onFieldChange("actionToStatus", event.target.value)}
                fullWidth
              >
                {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {getStatusLabel(status)}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

            {form.actionType === "assign_tag" ? (
              <TextField
                label="Тег"
                value={form.actionTag}
                onChange={(event) => onFieldChange("actionTag", event.target.value)}
                fullWidth
              />
            ) : null}

            {form.actionType === "create_notification" ? (
              <>
                <TextField
                  select
                  label="Кому"
                  value={form.actionTarget}
                  onChange={(event) => onFieldChange("actionTarget", event.target.value)}
                  fullWidth
                >
                  {targetOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                {form.actionTarget === "role" ? (
                  <TextField
                    select
                    label="Роль"
                    value={form.actionRole}
                    onChange={(event) => onFieldChange("actionRole", event.target.value)}
                    fullWidth
                  >
                    {roleOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
              </>
            ) : null}

            {form.actionType === "create_notification" ||
            form.actionType === "request_admin_attention" ? (
              <>
                <TextField
                  label="Заголовок"
                  value={form.actionTitle}
                  onChange={(event) => onFieldChange("actionTitle", event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Сообщение"
                  value={form.actionMessage}
                  onChange={(event) => onFieldChange("actionMessage", event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
              </>
            ) : null}
          </Stack>
        ) : null}

        <Divider />

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={onCreateRule} disabled={saving} fullWidth>
            {saving ? "Сохраняем..." : "Создать правило"}
          </Button>
          <Button variant="outlined" onClick={onResetDraft}>
            Сбросить
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
