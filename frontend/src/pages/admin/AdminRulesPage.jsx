import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";
import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../constants/labels";

const EVENT_OPTIONS = [
  "appointment.created",
  "appointment.master_taken",
  "appointment.price_set",
  "appointment.payment_marked",
  "appointment.payment_confirmed",
  "appointment.work_started",
  "appointment.work_completed",
  "review.master_created",
  "review.client_created",
  "chat.message_sent",
  "chat.message_deleted",
  "sla.breached",
];

const CONDITION_FIELD_OPTIONS = [
  { value: "appointment.status", label: "Статус заявки" },
  { value: "appointment.total_price", label: "Цена заявки" },
  { value: "client.risk_level", label: "Уровень риска клиента" },
  { value: "client.risk_score", label: "Скор риска клиента" },
  { value: "event.event_type", label: "Тип события" },
];

const OPERATOR_OPTIONS = ["==", "!=", ">=", "<=", ">", "<", "in", "not_in"];

const ACTION_OPTIONS = [
  { value: "request_admin_attention", label: "Запросить внимание админа" },
  { value: "create_notification", label: "Создать уведомление" },
  { value: "assign_tag", label: "Назначить тег заявке" },
  { value: "change_status", label: "Изменить статус заявки" },
];

function parseConditionValue(rawValue, operator) {
  const value = rawValue.trim();
  if (!value) return "";
  if (operator === "in" || operator === "not_in") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue) && value !== "") {
    return numberValue;
  }
  return value;
}

function buildConditionJson(builderState) {
  if (!builderState.enabled || !builderState.value.trim()) {
    return {};
  }
  return {
    all: [
      {
        field: builderState.field,
        op: builderState.op,
        value: parseConditionValue(builderState.value, builderState.op),
      },
    ],
  };
}

function buildActionJson(builderState) {
  if (builderState.type === "change_status") {
    return {
      type: "change_status",
      to_status: builderState.toStatus,
    };
  }
  if (builderState.type === "assign_tag") {
    return {
      type: "assign_tag",
      tag: builderState.tag.trim(),
    };
  }
  if (builderState.type === "create_notification") {
    return {
      type: "create_notification",
      target: builderState.target,
      role: builderState.role || undefined,
      title: builderState.title.trim() || "Системное уведомление",
      message: builderState.message.trim() || "",
    };
  }
  return {
    type: "request_admin_attention",
    title: builderState.title.trim() || "Требуется внимание администратора",
    message: builderState.message.trim() || "",
  };
}

export default function AdminRulesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    triggerEvent: "appointment.created",
    conditionEnabled: true,
    conditionField: "appointment.status",
    conditionOp: "==",
    conditionValue: "NEW",
    actionType: "request_admin_attention",
    actionTarget: "admins",
    actionRole: "admin",
    actionToStatus: "IN_REVIEW",
    actionTag: "",
    actionTitle: "",
    actionMessage: "",
  });

  const load = async () => {
    try {
      const response = await adminApi.rules();
      setRows(response.data || []);
      setError("");
    } catch {
      setError("Не удалось загрузить правила");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createRule = async () => {
    if (!form.name.trim()) {
      setError("Укажите название правила");
      return;
    }
    if (form.actionType === "assign_tag" && !form.actionTag.trim()) {
      setError("Укажите тег для действия assign_tag");
      return;
    }

    const conditionBuilder = {
      enabled: form.conditionEnabled,
      field: form.conditionField,
      op: form.conditionOp,
      value: form.conditionValue,
    };
    const actionBuilder = {
      type: form.actionType,
      target: form.actionTarget,
      role: form.actionRole,
      toStatus: form.actionToStatus,
      tag: form.actionTag,
      title: form.actionTitle,
      message: form.actionMessage,
    };

    const payload = {
      name: form.name.trim(),
      is_active: true,
      trigger_event_type: form.triggerEvent,
      condition_json: buildConditionJson(conditionBuilder),
      action_json: buildActionJson(actionBuilder),
    };

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adminApi.createRule(payload);
      setSuccess("Правило создано");
      setForm((prev) => ({ ...prev, name: "", actionTitle: "", actionMessage: "", actionTag: "" }));
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Не удалось создать правило");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (row) => {
    try {
      await adminApi.updateRule(row.id, { is_active: !row.is_active });
      await load();
    } catch {
      setError("Не удалось обновить правило");
    }
  };

  const removeRule = async (ruleId) => {
    try {
      await adminApi.deleteRule(ruleId);
      await load();
    } catch {
      setError("Не удалось удалить правило");
    }
  };

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography variant="h2">Правила автоматизации</Typography>
        <Chip label={`Активных правил: ${activeCount}`} color="primary" />
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Конструктор правила
        </Typography>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              label="Название правила"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Событие-триггер"
              value={form.triggerEvent}
              onChange={(event) => setForm((prev) => ({ ...prev, triggerEvent: event.target.value }))}
              sx={{ minWidth: 260 }}
            >
              {EVENT_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Switch
              checked={form.conditionEnabled}
              onChange={(event) => setForm((prev) => ({ ...prev, conditionEnabled: event.target.checked }))}
            />
            <Typography variant="body2">Добавить условие</Typography>
          </Stack>

          {form.conditionEnabled ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                select
                label="Поле"
                value={form.conditionField}
                onChange={(event) => setForm((prev) => ({ ...prev, conditionField: event.target.value }))}
                sx={{ minWidth: 220 }}
              >
                {CONDITION_FIELD_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Оператор"
                value={form.conditionOp}
                onChange={(event) => setForm((prev) => ({ ...prev, conditionOp: event.target.value }))}
                sx={{ minWidth: 140 }}
              >
                {OPERATOR_OPTIONS.map((operator) => (
                  <MenuItem key={operator} value={operator}>
                    {operator}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Значение"
                value={form.conditionValue}
                onChange={(event) => setForm((prev) => ({ ...prev, conditionValue: event.target.value }))}
                fullWidth
              />
            </Stack>
          ) : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              select
              label="Действие"
              value={form.actionType}
              onChange={(event) => setForm((prev) => ({ ...prev, actionType: event.target.value }))}
              sx={{ minWidth: 240 }}
            >
              {ACTION_OPTIONS.map((option) => (
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
                onChange={(event) => setForm((prev) => ({ ...prev, actionToStatus: event.target.value }))}
                sx={{ minWidth: 220 }}
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
                onChange={(event) => setForm((prev) => ({ ...prev, actionTag: event.target.value }))}
                fullWidth
              />
            ) : null}

            {form.actionType === "create_notification" ? (
              <>
                <TextField
                  select
                  label="Кому"
                  value={form.actionTarget}
                  onChange={(event) => setForm((prev) => ({ ...prev, actionTarget: event.target.value }))}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="admins">Админам</MenuItem>
                  <MenuItem value="client">Клиенту</MenuItem>
                  <MenuItem value="master">Мастеру</MenuItem>
                  <MenuItem value="role">По роли</MenuItem>
                </TextField>
                {form.actionTarget === "role" ? (
                  <TextField
                    select
                    label="Роль"
                    value={form.actionRole}
                    onChange={(event) => setForm((prev) => ({ ...prev, actionRole: event.target.value }))}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="admin">admin</MenuItem>
                    <MenuItem value="master">master</MenuItem>
                    <MenuItem value="client">client</MenuItem>
                  </TextField>
                ) : null}
              </>
            ) : null}
          </Stack>

          {form.actionType === "create_notification" || form.actionType === "request_admin_attention" ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                label="Заголовок"
                value={form.actionTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, actionTitle: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Сообщение"
                value={form.actionMessage}
                onChange={(event) => setForm((prev) => ({ ...prev, actionMessage: event.target.value }))}
                fullWidth
              />
            </Stack>
          ) : null}

          <Button variant="contained" onClick={createRule} disabled={saving}>
            {saving ? "Сохраняем..." : "Создать правило"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Событие</TableCell>
              <TableCell>Активно</TableCell>
              <TableCell>Действие</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.trigger_event_type}</TableCell>
                <TableCell>
                  <Switch checked={row.is_active} onChange={() => toggleRule(row)} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{row.action_json?.type || "—"}</Typography>
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    size="small"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() => removeRule(row.id)}
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
