import AutorenewIcon from "@mui/icons-material/Autorenew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";

const ACTIONS = [
  { id: "check", label: "Проверка системы" },
  { id: "migrate", label: "Применить миграции" },
  { id: "collectstatic", label: "Собрать статику" },
  { id: "clearsessions", label: "Очистить сессии" },
];

function BoolChip({ value, trueLabel = "Готово", falseLabel = "Не настроено" }) {
  return (
    <Chip
      size="small"
      color={value ? "success" : "warning"}
      label={value ? trueLabel : falseLabel}
      variant={value ? "filled" : "outlined"}
    />
  );
}

function getActionError(error) {
  if (error?.response?.data) {
    return error.response.data;
  }
  return { success: false, stderr: "Не удалось выполнить действие" };
}

export default function AdminSystemPage() {
  const [statusData, setStatusData] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [settingsData, setSettingsData] = useState({
    bank_requisites: "",
    crypto_requisites: "",
    instructions: "",
  });
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [runningAction, setRunningAction] = useState("");
  const [actionResult, setActionResult] = useState(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError("");
    try {
      const response = await adminApi.systemStatus();
      setStatusData(response.data);
    } catch (error) {
      setStatusError(error?.response?.data?.detail || "Не удалось загрузить состояние системы");
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadSettings = async () => {
    setSettingsError("");
    try {
      const response = await adminApi.systemSettings();
      setSettingsData(response.data);
    } catch (error) {
      setSettingsError(error?.response?.data?.detail || "Не удалось загрузить реквизиты оплаты");
    }
  };

  useEffect(() => {
    loadStatus();
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      const response = await adminApi.updateSystemSettings(settingsData);
      setSettingsData(response.data);
      setSettingsSuccess("Реквизиты и инструкции сохранены.");
      await loadStatus();
    } catch (error) {
      setSettingsError(error?.response?.data?.detail || "Не удалось сохранить настройки");
    } finally {
      setSavingSettings(false);
    }
  };

  const runAction = async (actionId) => {
    setRunningAction(actionId);
    try {
      const response = await adminApi.runSystemAction(actionId);
      setActionResult(response.data);
      await loadStatus();
    } catch (error) {
      setActionResult(getActionError(error));
    } finally {
      setRunningAction("");
    }
  };

  const outputText = useMemo(() => {
    if (!actionResult) {
      return "";
    }
    return [actionResult.stdout || "", actionResult.stderr || ""].filter(Boolean).join("\n");
  }, [actionResult]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Админ: система</Typography>
        <Button variant="outlined" startIcon={<AutorenewIcon />} onClick={loadStatus} disabled={loadingStatus}>
          Обновить статус
        </Button>
      </Stack>

      {statusError && <Alert severity="error">{statusError}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Состояние сервера</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">База данных:</Typography>
            <BoolChip value={Boolean(statusData?.database?.connected)} trueLabel="Подключена" falseLabel="Ошибка подключения" />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">Токен Telegram:</Typography>
            <BoolChip value={Boolean(statusData?.telegram?.bot_token_configured)} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">Имя бота Telegram:</Typography>
            <BoolChip value={Boolean(statusData?.telegram?.login_username_configured)} />
            {statusData?.telegram?.login_username ? (
              <Typography variant="body2" color="text.secondary">
                @{statusData.telegram.login_username}
              </Typography>
            ) : null}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">Реквизиты оплаты:</Typography>
            <BoolChip value={Boolean(statusData?.payments?.bank_requisites_configured)} trueLabel="Банк OK" falseLabel="Банк пусто" />
            <BoolChip value={Boolean(statusData?.payments?.crypto_requisites_configured)} trueLabel="Крипта OK" falseLabel="Крипта пусто" />
            <BoolChip value={Boolean(statusData?.payments?.instructions_configured)} trueLabel="Инструкция OK" falseLabel="Инструкция пусто" />
          </Stack>
          {statusData?.database?.error ? <Alert severity="error">{statusData.database.error}</Alert> : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={1}>Счетчики</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Typography variant="body2">Пользователи: {statusData?.counts?.users_total ?? "-"}</Typography>
          <Typography variant="body2">Клиенты: {statusData?.counts?.clients_total ?? "-"}</Typography>
          <Typography variant="body2">Мастера: {statusData?.counts?.masters_total ?? "-"}</Typography>
          <Typography variant="body2">Администраторы: {statusData?.counts?.admins_total ?? "-"}</Typography>
          <Typography variant="body2">Заявки: {statusData?.counts?.appointments_total ?? "-"}</Typography>
          <Typography variant="body2">Активные заявки: {statusData?.counts?.appointments_active ?? "-"}</Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={1}>Реквизиты и инструкции оплаты</Typography>
        <Stack spacing={1.5}>
          {settingsError && <Alert severity="error">{settingsError}</Alert>}
          {settingsSuccess && <Alert severity="success">{settingsSuccess}</Alert>}

          <TextField
            label="Банковские реквизиты"
            multiline
            minRows={2}
            value={settingsData.bank_requisites}
            onChange={(e) => setSettingsData((prev) => ({ ...prev, bank_requisites: e.target.value }))}
          />
          <TextField
            label="Криптореквизиты"
            multiline
            minRows={2}
            value={settingsData.crypto_requisites}
            onChange={(e) => setSettingsData((prev) => ({ ...prev, crypto_requisites: e.target.value }))}
          />
          <TextField
            label="Инструкция для клиента"
            multiline
            minRows={3}
            value={settingsData.instructions}
            onChange={(e) => setSettingsData((prev) => ({ ...prev, instructions: e.target.value }))}
          />
          <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={1}>Сервисные действия</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={Boolean(runningAction)}
              onClick={() => runAction(action.id)}
            >
              {runningAction === action.id ? "Выполняется..." : action.label}
            </Button>
          ))}
        </Stack>
      </Paper>

      {actionResult ? (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Результат действия</Typography>
            <Alert severity={actionResult.success ? "success" : "error"}>
              {actionResult.success ? "Успешно" : "С ошибкой"} | {actionResult.action || "неизвестно"} | {actionResult.duration_seconds ?? "-"} сек
            </Alert>
            <Typography component="pre" sx={{ whiteSpace: "pre-wrap", m: 0, fontFamily: "monospace", fontSize: 13 }}>
              {outputText || "Вывод отсутствует"}
            </Typography>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
