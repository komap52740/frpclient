import AutorenewIcon from "@mui/icons-material/Autorenew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { adminApi, notificationsApi } from "../../api/client";
import KpiTiles from "../../components/ui/KpiTiles";

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

function MiniBars({ values }) {
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);

  return (
    <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ minHeight: 64 }}>
      {safeValues.map((value, index) => (
        <Box
          key={`${index}-${value}`}
          sx={{
            width: 10,
            height: `${Math.max((value / max) * 100, 6)}%`,
            bgcolor: "primary.main",
            borderRadius: 1,
            opacity: 0.85,
          }}
        />
      ))}
    </Stack>
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
    sla_response_minutes: 15,
    sla_completion_hours: 24,
  });
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [runningAction, setRunningAction] = useState("");
  const [actionResult, setActionResult] = useState(null);

  const [metricsRows, setMetricsRows] = useState([]);
  const [metricsError, setMetricsError] = useState("");

  const [unreadNotifications, setUnreadNotifications] = useState([]);

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
      setSettingsData((prev) => ({ ...prev, ...response.data }));
    } catch (error) {
      setSettingsError(error?.response?.data?.detail || "Не удалось загрузить реквизиты оплаты");
    }
  };

  const loadMetrics = async () => {
    const from = dayjs().subtract(13, "day").format("YYYY-MM-DD");
    const to = dayjs().format("YYYY-MM-DD");
    try {
      const response = await adminApi.dailyMetrics({ from, to });
      const rows = (response.data || []).slice().sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      setMetricsRows(rows);
      setMetricsError("");
    } catch {
      setMetricsError("Не удалось загрузить метрики");
    }
  };

  const loadUnreadNotifications = async () => {
    try {
      const response = await notificationsApi.list({ is_read: 0 });
      setUnreadNotifications((response.data || []).slice(0, 6));
    } catch {
      // Keep dashboard stable on notification API hiccups.
    }
  };

  useEffect(() => {
    loadStatus();
    loadSettings();
    loadMetrics();
    loadUnreadNotifications();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsError("");
    setSettingsSuccess("");
    try {
      const response = await adminApi.updateSystemSettings(settingsData);
      setSettingsData(response.data);
      setSettingsSuccess("Настройки системы сохранены.");
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

  const latestMetrics = metricsRows.length ? metricsRows[metricsRows.length - 1] : null;

  const metricsTiles = useMemo(() => {
    if (!latestMetrics) return [];
    return [
      { label: "GMV за день", value: `${latestMetrics.gmv_total || 0} ₽`, tone: "info" },
      { label: "Новые заявки", value: latestMetrics.new_appointments || 0, tone: "default" },
      { label: "Оплаченные", value: latestMetrics.paid_appointments || 0, tone: "success" },
      { label: "Завершенные", value: latestMetrics.completed_appointments || 0, tone: "success" },
      {
        label: "Конверсия в оплату",
        value: `${Math.round((latestMetrics.conversion_new_to_paid || 0) * 100)}%`,
        tone: "warning",
      },
      {
        label: "Время первого ответа",
        value: `${Math.round((latestMetrics.avg_time_to_first_response || 0) / 60)} мин`,
        tone: "default",
      },
      {
        label: "Время до завершения",
        value: `${Math.round((latestMetrics.avg_time_to_complete || 0) / 60)} мин`,
        tone: "default",
      },
      { label: "Новые пользователи", value: latestMetrics.new_users || 0, tone: "info" },
    ];
  }, [latestMetrics]);

  const outputText = useMemo(() => {
    if (!actionResult) {
      return "";
    }
    return [actionResult.stdout || "", actionResult.stderr || ""].filter(Boolean).join("\n");
  }, [actionResult]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h2">Админ-пульт</Typography>
        <Button
          variant="outlined"
          startIcon={<AutorenewIcon />}
          onClick={() => {
            loadStatus();
            loadMetrics();
            loadUnreadNotifications();
          }}
          disabled={loadingStatus}
        >
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>Критичные сигналы</Typography>
        {unreadNotifications.length ? (
          <Stack spacing={0.8}>
            {unreadNotifications.map((notification) => (
              <Paper key={notification.id} variant="outlined" sx={{ p: 1.2, borderStyle: "dashed" }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{notification.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.message || "Системное уведомление"}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">Новых сигналов нет.</Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Typography variant="h3">Метрики за 14 дней</Typography>
          <Typography variant="caption" color="text.secondary">
            Последняя дата: {latestMetrics?.date || "—"}
          </Typography>
        </Stack>

        {metricsError ? <Alert severity="error" sx={{ mt: 1 }}>{metricsError}</Alert> : null}

        {latestMetrics ? (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <KpiTiles items={metricsTiles} />
            <Divider />
            <Stack spacing={0.6}>
              <Typography variant="caption">Динамика новых заявок</Typography>
              <MiniBars values={metricsRows.map((row) => row.new_appointments || 0)} />
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Метрики пока не собраны. Запустите расчет командой `python manage.py compute_daily_metrics --date=YYYY-MM-DD`.
          </Typography>
        )}
      </Paper>

      {statusError ? <Alert severity="error">{statusError}</Alert> : null}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h3">Состояние системы</Typography>
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
              <Typography variant="body2" color="text.secondary">@{statusData.telegram.login_username}</Typography>
            ) : null}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">SLA:</Typography>
            <Typography variant="body2" color="text.secondary">
              Ответ {statusData?.sla?.response_minutes ?? settingsData.sla_response_minutes} мин, завершение {statusData?.sla?.completion_hours ?? settingsData.sla_completion_hours} ч
            </Typography>
          </Stack>
          {statusData?.database?.error ? <Alert severity="error">{statusData.database.error}</Alert> : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" mb={1}>Реквизиты и системные настройки</Typography>
        <Stack spacing={1.5}>
          {settingsError ? <Alert severity="error">{settingsError}</Alert> : null}
          {settingsSuccess ? <Alert severity="success">{settingsSuccess}</Alert> : null}

          <TextField
            label="Банковские реквизиты"
            multiline
            minRows={2}
            value={settingsData.bank_requisites}
            onChange={(event) => setSettingsData((prev) => ({ ...prev, bank_requisites: event.target.value }))}
          />
          <TextField
            label="Криптореквизиты"
            multiline
            minRows={2}
            value={settingsData.crypto_requisites}
            onChange={(event) => setSettingsData((prev) => ({ ...prev, crypto_requisites: event.target.value }))}
          />
          <TextField
            label="Инструкция для клиента"
            multiline
            minRows={3}
            value={settingsData.instructions}
            onChange={(event) => setSettingsData((prev) => ({ ...prev, instructions: event.target.value }))}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="SLA ответ (мин)"
              type="number"
              value={settingsData.sla_response_minutes}
              onChange={(event) => setSettingsData((prev) => ({ ...prev, sla_response_minutes: Number(event.target.value || 0) }))}
            />
            <TextField
              label="SLA завершение (ч)"
              type="number"
              value={settingsData.sla_completion_hours}
              onChange={(event) => setSettingsData((prev) => ({ ...prev, sla_completion_hours: Number(event.target.value || 0) }))}
            />
          </Stack>

          <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" mb={1}>Сервисные действия</Typography>
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
            <Typography variant="h3">Результат действия</Typography>
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
