import AutorenewIcon from "@mui/icons-material/Autorenew";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminApi, notificationsApi } from "../../api/client";
import KpiTiles from "../../components/ui/KpiTiles";
import AppointmentStatusChart from "../../features/platform/admin-dashboard/ui/AppointmentStatusChart";
import FinanceTrendChart from "../../features/platform/admin-dashboard/ui/FinanceTrendChart";
import OpsLatencyChart from "../../features/platform/admin-dashboard/ui/OpsLatencyChart";
import SlaBreachesChart from "../../features/platform/admin-dashboard/ui/SlaBreachesChart";

const ACTIONS = [
  { id: "check", label: "Проверка системы" },
  { id: "migrate", label: "Применить миграции" },
  { id: "collectstatic", label: "Собрать статику" },
  { id: "clearsessions", label: "Очистить сессии" },
  { id: "flushexpiredtokens", label: "Очистить токены" },
  { id: "compute_daily_metrics", label: "Пересчитать метрики" },
];

const PAYMENT_STATE_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "pending", label: "Ждут проверки" },
  { value: "confirmed", label: "Подтверждены" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Все способы" },
  { value: "bank_transfer", label: "Банковский перевод" },
  { value: "crypto", label: "Криптовалюта" },
];

const JOB_LABELS = {
  public_smoke: "Public smoke",
  runtime_audit: "Runtime audit",
  managed_acceptance: "Managed acceptance",
  deploy: "Последний deploy",
  postgres_backup: "Postgres backup",
  postgres_verify: "Postgres verify",
  media_backup: "Media backup",
  media_verify: "Media verify",
  certbot_dry_run: "Certbot dry-run",
  django_housekeeping: "Django housekeeping",
  platform_metrics_refresh: "Metrics refresh",
};

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

function OpsStateChip({ state, activeLabel, inactiveLabel }) {
  const active = Boolean(state?.active);
  const stale = Boolean(state?.stale);
  let color = "success";
  let label = inactiveLabel;

  if (active && stale) {
    color = "error";
    label = `${activeLabel} (зависло)`;
  } else if (active) {
    color = "warning";
    label = activeLabel;
  }

  return <Chip size="small" color={color} label={label} variant={active ? "filled" : "outlined"} />;
}

function formatOpsStateMeta(state, timestampKey) {
  if (!state?.active) return "";

  const parts = [];
  if (state.reason) {
    parts.push(`Причина: ${state.reason}`);
  }
  if (state[timestampKey]) {
    const timestamp = dayjs(state[timestampKey]);
    if (timestamp.isValid()) {
      parts.push(`С ${timestamp.format("DD.MM.YYYY HH:mm")}`);
    }
  }
  if (typeof state.age_seconds === "number") {
    parts.push(`Возраст: ${Math.max(1, Math.round(state.age_seconds / 60))} мин`);
  }
  return parts.join(" · ");
}

function getJobStatusChip(job) {
  if (!job || job.status === "missing") {
    return { color: "warning", label: "Нет данных" };
  }
  if (job.stale) {
    return { color: "error", label: "Устарело" };
  }
  if (job.status === "success") {
    return { color: "success", label: "OK" };
  }
  if (job.status === "skipped") {
    return { color: "warning", label: "Пропущено" };
  }
  if (job.status === "running") {
    return { color: "info", label: "Выполняется" };
  }
  return { color: "error", label: "Ошибка" };
}

function formatJobMeta(job) {
  if (!job) return "";

  const parts = [];
  const finishedAt = dayjs(job.finished_at || job.updated_at || job.started_at);
  if (finishedAt.isValid()) {
    parts.push(`Последний запуск: ${finishedAt.format("DD.MM.YYYY HH:mm")}`);
  }
  if (typeof job.age_seconds === "number") {
    parts.push(`Возраст: ${Math.max(1, Math.round(job.age_seconds / 60))} мин`);
  }
  if (typeof job.duration_seconds === "number" && job.duration_seconds > 0) {
    parts.push(`Длительность: ${job.duration_seconds.toFixed(1)} сек`);
  }
  return parts.join(" · ");
}

function formatRollbackMeta(rollback) {
  if (!rollback) return "";

  const parts = [];
  const latestCreatedAt = dayjs(rollback.latest_created_at);
  if (latestCreatedAt.isValid()) {
    parts.push(`Последний snapshot: ${latestCreatedAt.format("DD.MM.YYYY HH:mm")}`);
  }
  if (typeof rollback.latest_age_seconds === "number") {
    parts.push(`Возраст: ${Math.max(1, Math.round(rollback.latest_age_seconds / 60))} мин`);
  }
  return parts.join(" · ");
}

function formatReleaseMeta(releaseState) {
  if (!releaseState) return "";

  const parts = [];
  const finishedAt = dayjs(
    releaseState.finished_at || releaseState.updated_at || releaseState.started_at
  );
  if (finishedAt.isValid()) {
    parts.push(`Последнее изменение: ${finishedAt.format("DD.MM.YYYY HH:mm")}`);
  }
  if (typeof releaseState.age_seconds === "number") {
    parts.push(`Возраст: ${Math.max(1, Math.round(releaseState.age_seconds / 60))} мин`);
  }
  if (typeof releaseState.duration_seconds === "number" && releaseState.duration_seconds > 0) {
    parts.push(`Длительность: ${releaseState.duration_seconds.toFixed(1)} сек`);
  }
  return parts.join(" · ");
}

function getActionError(error) {
  if (error?.response?.data) {
    return error.response.data;
  }
  return { success: false, stderr: "Не удалось выполнить действие" };
}

export default function AdminSystemPage() {
  const navigate = useNavigate();
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
  const [financeSummary, setFinanceSummary] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);

  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [wholesalePendingCount, setWholesalePendingCount] = useState(0);
  const [paymentRegistryRows, setPaymentRegistryRows] = useState([]);
  const [paymentRegistryTotal, setPaymentRegistryTotal] = useState(0);
  const [paymentRegistryLoading, setPaymentRegistryLoading] = useState(false);
  const [paymentRegistryError, setPaymentRegistryError] = useState("");
  const [paymentRegistryFilters, setPaymentRegistryFilters] = useState({
    state: "all",
    payment_method: "",
    from: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
  });

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
      const rows = (response.data || [])
        .slice()
        .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      setMetricsRows(rows);
      setMetricsError("");
    } catch {
      setMetricsError("Не удалось загрузить метрики");
    }
  };

  const loadFinanceSummary = async () => {
    try {
      const response = await adminApi.financeSummary();
      setFinanceSummary(response.data || null);
    } catch {
      // Keep dashboard stable on finance API hiccups.
    }
  };

  const loadWeeklyReport = async () => {
    try {
      const response = await adminApi.weeklyReport();
      setWeeklyReport(response.data || null);
    } catch {
      // Keep dashboard stable on report API hiccups.
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

  const loadWholesalePending = async () => {
    try {
      const response = await adminApi.wholesaleRequests({ status: "pending" });
      const rows = Array.isArray(response.data) ? response.data : response.data?.results || [];
      setWholesalePendingCount(rows.length);
    } catch {
      // Keep dashboard stable on wholesale API hiccups.
    }
  };

  const loadPaymentRegistry = async (filters = paymentRegistryFilters) => {
    setPaymentRegistryLoading(true);
    try {
      const params = {
        state: filters.state,
        payment_method: filters.payment_method,
        from: filters.from,
        to: filters.to,
        limit: 120,
      };
      const response = await adminApi.paymentRegistry(params);
      const payload = response.data || {};
      setPaymentRegistryRows(Array.isArray(payload.results) ? payload.results : []);
      setPaymentRegistryTotal(Number(payload.count || 0));
      setPaymentRegistryError("");
    } catch (error) {
      setPaymentRegistryError(error?.response?.data?.detail || "Не удалось загрузить реестр оплат");
    } finally {
      setPaymentRegistryLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadSettings();
    loadMetrics();
    loadFinanceSummary();
    loadWeeklyReport();
    loadUnreadNotifications();
    loadWholesalePending();
    loadPaymentRegistry();
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

  const updatePaymentFilter = (name, value) => {
    setPaymentRegistryFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyPaymentRegistryFilters = async () => {
    await loadPaymentRegistry(paymentRegistryFilters);
  };

  const exportPaymentRegistryCsv = async () => {
    try {
      const response = await adminApi.paymentRegistryExport({
        state: paymentRegistryFilters.state,
        payment_method: paymentRegistryFilters.payment_method,
        from: paymentRegistryFilters.from,
        to: paymentRegistryFilters.to,
      });
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payment-registry-${dayjs().format("YYYY-MM-DD")}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setPaymentRegistryError(error?.response?.data?.detail || "Не удалось выгрузить CSV");
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

  const jobStatusEntries = useMemo(
    () =>
      Object.keys(JOB_LABELS)
        .filter((key) => statusData?.operations?.jobs?.[key])
        .map((key) => ({ key, label: JOB_LABELS[key], job: statusData.operations.jobs[key] })),
    [statusData]
  );

  const unhealthyJobCount = useMemo(
    () =>
      jobStatusEntries.filter(
        ({ job }) => job.stale || !["success", "skipped"].includes(job.status || "")
      ).length,
    [jobStatusEntries]
  );
  const releaseState = statusData?.operations?.release || null;
  const releaseHistoryEntries = useMemo(
    () => (Array.isArray(releaseState?.history) ? releaseState.history.slice(0, 4) : []),
    [releaseState]
  );
  const rollbackInventory = statusData?.operations?.rollback || null;

  const focusCards = useMemo(
    () => [
      {
        label: "Непрочитанные сигналы",
        value: unreadNotifications.length,
        color: unreadNotifications.length ? "error" : "default",
      },
      {
        label: "B2B-заявки на проверке",
        value: wholesalePendingCount,
        color: wholesalePendingCount ? "warning" : "default",
      },
      {
        label: "Платежи на подтверждении",
        value: Number(statusData?.appointments?.awaiting_payment_confirmation || 0),
        color: "info",
      },
    ],
    [
      statusData?.appointments?.awaiting_payment_confirmation,
      unreadNotifications.length,
      wholesalePendingCount,
    ]
  );

  const primaryOpsAction = useMemo(() => {
    if (unreadNotifications.length) {
      return {
        label: "Открыть заявки с сигналами",
        onClick: () => navigate("/admin/appointments"),
      };
    }
    if (wholesalePendingCount > 0) {
      return { label: "Проверить B2B-клиентов", onClick: () => navigate("/admin/clients") };
    }
    return { label: "Открыть системные правила", onClick: () => navigate("/admin/rules") };
  }, [navigate, unreadNotifications.length, wholesalePendingCount]);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h2">Админ-пульт</Typography>
        <Button
          variant="outlined"
          startIcon={<AutorenewIcon />}
          onClick={() => {
            loadStatus();
            loadMetrics();
            loadFinanceSummary();
            loadWeeklyReport();
            loadUnreadNotifications();
            loadWholesalePending();
            loadPaymentRegistry();
          }}
          disabled={loadingStatus}
        >
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="h3">Операционный фокус</Typography>
            <Button variant="contained" size="small" onClick={primaryOpsAction.onClick}>
              {primaryOpsAction.label}
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {focusCards.map((card) => (
              <Chip
                key={card.label}
                label={`${card.label}: ${card.value}`}
                color={card.color}
                variant={card.value ? "filled" : "outlined"}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Начинайте работу с этого блока: он показывает, где сейчас самое узкое место по сервису.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Финансовый блок
        </Typography>
        {financeSummary ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={`Оплачено: ${(financeSummary.paid_total || 0).toLocaleString("ru-RU")} ₽`}
            />
            <Chip
              size="small"
              color="info"
              variant="outlined"
              label={`В работе: ${(financeSummary.in_work_total || 0).toLocaleString("ru-RU")} ₽`}
            />
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`За период: ${(financeSummary.period_total || 0).toLocaleString("ru-RU")} ₽`}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Финансовая сводка недоступна.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ mb: 1.2 }}
        >
          <Stack spacing={0.2}>
            <Typography variant="h3">Реестр оплат</Typography>
            <Typography variant="caption" color="text.secondary">
              Отдельный журнал: чек, способ оплаты, кто подтвердил, история правок.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip size="small" variant="outlined" label={`Записей: ${paymentRegistryTotal}`} />
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={exportPaymentRegistryCsv}
            >
              Экспорт CSV
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.2 }}>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
            <InputLabel id="payment-state-label">Статус</InputLabel>
            <Select
              labelId="payment-state-label"
              value={paymentRegistryFilters.state}
              label="Статус"
              onChange={(event) => updatePaymentFilter("state", event.target.value)}
            >
              {PAYMENT_STATE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 220 } }}>
            <InputLabel id="payment-method-label">Способ оплаты</InputLabel>
            <Select
              labelId="payment-method-label"
              value={paymentRegistryFilters.payment_method}
              label="Способ оплаты"
              onChange={(event) => updatePaymentFilter("payment_method", event.target.value)}
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="От"
            InputLabelProps={{ shrink: true }}
            value={paymentRegistryFilters.from}
            onChange={(event) => updatePaymentFilter("from", event.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="До"
            InputLabelProps={{ shrink: true }}
            value={paymentRegistryFilters.to}
            onChange={(event) => updatePaymentFilter("to", event.target.value)}
          />
          <Button
            size="small"
            variant="contained"
            onClick={applyPaymentRegistryFilters}
            disabled={paymentRegistryLoading}
          >
            Обновить реестр
          </Button>
        </Stack>

        {paymentRegistryError ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {paymentRegistryError}
          </Alert>
        ) : null}

        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Заявка</TableCell>
                <TableCell>Клиент</TableCell>
                <TableCell>Мастер</TableCell>
                <TableCell>Способ</TableCell>
                <TableCell>Чек</TableCell>
                <TableCell>Подтвердил</TableCell>
                <TableCell>История правок</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentRegistryRows.map((row) => (
                <TableRow key={row.appointment_id} hover>
                  <TableCell>
                    <Stack spacing={0.3}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        #{row.appointment_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.status}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.total_price
                          ? `${Number(row.total_price).toLocaleString("ru-RU")} ₽`
                          : "Цена не указана"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{row.client_username || "—"}</TableCell>
                  <TableCell>{row.master_username || "—"}</TableCell>
                  <TableCell>
                    <Stack spacing={0.2}>
                      <Typography variant="body2">
                        {row.payment_method_label || row.payment_method || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.payment_requisites_note || "Реквизиты не указаны"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {row.payment_proof_url ? (
                      <Button
                        size="small"
                        variant="text"
                        href={row.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть чек
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Нет файла
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.2}>
                      <Typography variant="body2">
                        {row.payment_confirmed_by_username || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.payment_confirmed_at
                          ? dayjs(row.payment_confirmed_at).format("DD.MM.YYYY HH:mm")
                          : "Не подтверждено"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Stack spacing={0.4}>
                      {(row.history || []).slice(0, 3).map((eventItem) => (
                        <Typography key={eventItem.id} variant="caption" color="text.secondary">
                          {dayjs(eventItem.created_at).format("DD.MM HH:mm")} —{" "}
                          {eventItem.event_label || eventItem.event_type}
                          {" · "}
                          {eventItem.actor_username || "система"}
                        </Typography>
                      ))}
                      {!row.history?.length ? (
                        <Typography variant="caption" color="text.secondary">
                          История пустая
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!paymentRegistryRows.length && !paymentRegistryLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      В реестре оплат пока нет записей по текущим фильтрам.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Еженедельный отчет
        </Typography>
        {weeklyReport ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              variant="outlined"
              label={`SLA нарушено: ${weeklyReport.sla_breached_count || 0}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Средний ответ: ${Math.round((weeklyReport.avg_first_response_seconds || 0) / 60) || 0} мин`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Закрытые заявки: ${weeklyReport.closed_count || 0}`}
            />
            <Chip
              size="small"
              color={(weeklyReport.problematic_cases_count || 0) > 0 ? "warning" : "default"}
              variant={(weeklyReport.problematic_cases_count || 0) > 0 ? "filled" : "outlined"}
              label={`Проблемные кейсы: ${weeklyReport.problematic_cases_count || 0}`}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Недельный отчет недоступен.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Критичные сигналы
        </Typography>
        {unreadNotifications.length ? (
          <Stack spacing={0.8}>
            {unreadNotifications.map((notification) => (
              <Paper
                key={notification.id}
                variant="outlined"
                sx={{ p: 1.2, borderStyle: "dashed" }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {notification.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.message || "Системное уведомление"}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Новых сигналов нет.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Typography variant="h3">Метрики за 14 дней</Typography>
          <Typography variant="caption" color="text.secondary">
            Последняя дата: {latestMetrics?.date || "—"}
          </Typography>
        </Stack>

        {metricsError ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {metricsError}
          </Alert>
        ) : null}

        {latestMetrics ? (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <KpiTiles items={metricsTiles} />
            <Divider />
            <Grid container spacing={2}>
              <Grid item xs={12} lg={7}>
                <FinanceTrendChart rows={metricsRows} />
              </Grid>
              <Grid item xs={12} lg={5}>
                <SlaBreachesChart weeklyReport={weeklyReport} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <AppointmentStatusChart rows={metricsRows} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <OpsLatencyChart rows={metricsRows} />
              </Grid>
            </Grid>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Метрики пока не собраны. Запустите расчет командой `python manage.py
            compute_daily_metrics --date=YYYY-MM-DD`.
          </Typography>
        )}
      </Paper>

      {statusError ? <Alert severity="error">{statusError}</Alert> : null}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h3">Состояние системы</Typography>
          {statusData?.operations?.deploy_lock?.stale ? (
            <Alert severity="error">
              Deploy lock висит дольше нормы. Проверьте зависший deploy/rollback и снимите lock
              вручную после проверки.
            </Alert>
          ) : null}
          {statusData?.operations?.maintenance_mode?.stale ? (
            <Alert severity="error">
              Maintenance mode включен слишком долго. Проверьте marker и снимите его после
              завершения работ.
            </Alert>
          ) : null}
          {releaseState?.available && !releaseState.healthy ? (
            <Alert severity="warning">
              Current release metadata устарела или повреждена. Следующий штатный deploy/rollback
              должен её восстановить.
            </Alert>
          ) : null}
          {releaseState && !releaseState.available ? (
            <Alert severity="warning">
              Current release metadata пока не записана. После следующего штатного deploy/rollback
              админка начнет показывать текущий live release.
            </Alert>
          ) : null}
          {rollbackInventory && !rollbackInventory.healthy ? (
            <Alert severity="warning">
              Rollback snapshots недоступны или повреждены. Проверьте `.deploy/rollback/manifests` и
              снимите новый snapshot перед следующим релизом.
            </Alert>
          ) : null}
          {rollbackInventory?.healthy && rollbackInventory.invalid_count > 0 ? (
            <Alert severity="warning">
              В rollback inventory есть битые manifest-файлы: {rollbackInventory.invalid_count}.
              Последний snapshot пригоден, но старые точки лучше проверить.
            </Alert>
          ) : null}
          {rollbackInventory?.last_run &&
          rollbackInventory.last_run.status !== "missing" &&
          (rollbackInventory.last_run.stale ||
            !["success", "skipped"].includes(rollbackInventory.last_run.status || "")) ? (
            <Alert severity="warning">
              Последний rollback завершился неидеально. Проверьте recovery path и повторите drill до
              следующего критичного релиза.
            </Alert>
          ) : null}
          {unhealthyJobCount > 0 ? (
            <Alert severity="warning">
              Есть фоновые задачи без свежего успешного статуса. Проверьте блок мониторинга ниже.
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">База данных:</Typography>
            <BoolChip
              value={Boolean(statusData?.database?.connected)}
              trueLabel="Подключена"
              falseLabel="Ошибка подключения"
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">Deploy lock:</Typography>
            <OpsStateChip
              state={statusData?.operations?.deploy_lock}
              activeLabel="Активен"
              inactiveLabel="Нет"
            />
            {statusData?.operations?.deploy_lock?.active ? (
              <Typography variant="body2" color="text.secondary">
                {formatOpsStateMeta(statusData?.operations?.deploy_lock, "locked_at")}
              </Typography>
            ) : null}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Typography variant="body2">Maintenance mode:</Typography>
            <OpsStateChip
              state={statusData?.operations?.maintenance_mode}
              activeLabel="Включен"
              inactiveLabel="Выключен"
            />
            {statusData?.operations?.maintenance_mode?.active ? (
              <Typography variant="body2" color="text.secondary">
                {formatOpsStateMeta(statusData?.operations?.maintenance_mode, "enabled_at")}
              </Typography>
            ) : null}
          </Stack>
          <Stack spacing={0.8}>
            <Typography variant="body2">Current release:</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color={releaseState?.healthy ? "success" : "warning"}
                label={
                  !releaseState?.available
                    ? "Release metadata нет"
                    : releaseState?.action === "rollback"
                      ? "Live после rollback"
                      : "Live после deploy"
                }
                variant={releaseState?.healthy ? "filled" : "outlined"}
              />
              {releaseState?.git_commit ? (
                <Chip size="small" variant="outlined" label={`Git: ${releaseState.git_commit}`} />
              ) : null}
              {releaseState?.git_branch ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Branch: ${releaseState.git_branch}`}
                />
              ) : null}
              {releaseState?.source_fingerprint_short ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Source: ${releaseState.source_fingerprint_short}`}
                />
              ) : null}
              {releaseState?.with_bot ? (
                <Chip size="small" color="info" variant="outlined" label="Telegram bot включен" />
              ) : null}
              {releaseState?.rollback_snapshot_label ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Rollback point: ${releaseState.rollback_snapshot_label}`}
                />
              ) : null}
              {releaseState?.restored_snapshot_label ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Восстановлено из: ${releaseState.restored_snapshot_label}`}
                />
              ) : null}
            </Stack>
            {formatReleaseMeta(releaseState) ? (
              <Typography variant="body2" color="text.secondary">
                {formatReleaseMeta(releaseState)}
              </Typography>
            ) : null}
            {releaseState?.base_url ? (
              <Typography variant="caption" color="text.secondary">
                Base URL: {releaseState.base_url}
              </Typography>
            ) : null}
            {releaseState?.containers && Object.keys(releaseState.containers).length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(releaseState.containers)
                  .filter(([, container]) => container?.container_name)
                  .map(([key, container]) => (
                    <Chip
                      key={key}
                      size="small"
                      variant="outlined"
                      label={`${container.container_name}: ${container.image_id_short || "unknown"}`}
                    />
                  ))}
              </Stack>
            ) : null}
            {releaseState?.error ? (
              <Typography variant="caption" color="error">
                {releaseState.error}
              </Typography>
            ) : null}
            {releaseHistoryEntries.length ? (
              <Stack spacing={0.6}>
                <Typography variant="caption" color="text.secondary">
                  Последние live transitions
                </Typography>
                {releaseHistoryEntries.map((entry) => (
                  <Paper
                    key={`${entry.release_label || "unknown"}-${entry.action || "unknown"}-${entry.finished_at || entry.updated_at || entry.started_at || "na"}`}
                    variant="outlined"
                    sx={{ p: 1.1 }}
                  >
                    <Stack spacing={0.4}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {entry.action === "rollback" ? "Rollback" : "Deploy"}
                        </Typography>
                        <Chip
                          size="small"
                          color={entry.action === "rollback" ? "warning" : "success"}
                          variant="outlined"
                          label={entry.release_label || "без label"}
                        />
                      </Stack>
                      {formatReleaseMeta(entry) ? (
                        <Typography variant="caption" color="text.secondary">
                          {formatReleaseMeta(entry)}
                        </Typography>
                      ) : null}
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {entry.source_fingerprint_short ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Source: ${entry.source_fingerprint_short}`}
                          />
                        ) : null}
                        {entry.rollback_snapshot_label ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Rollback point: ${entry.rollback_snapshot_label}`}
                          />
                        ) : null}
                        {entry.restored_snapshot_label ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Восстановлено из: ${entry.restored_snapshot_label}`}
                          />
                        ) : null}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : null}
          </Stack>
          <Stack spacing={0.8}>
            <Typography variant="body2">Rollback snapshots:</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color={rollbackInventory?.healthy ? "success" : "warning"}
                label={rollbackInventory?.healthy ? "Rollback готов" : "Rollback требует внимания"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Точек: ${rollbackInventory?.available_count ?? 0}`}
              />
              {rollbackInventory?.latest_label ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Последняя: ${rollbackInventory.latest_label}`}
                />
              ) : null}
              {rollbackInventory?.latest_with_bot ? (
                <Chip size="small" color="info" variant="outlined" label="Bot snapshot включен" />
              ) : null}
              {rollbackInventory?.latest_source_fingerprint_short ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Source: ${rollbackInventory.latest_source_fingerprint_short}`}
                />
              ) : null}
              {rollbackInventory?.latest_git_commit ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Git: ${rollbackInventory.latest_git_commit}`}
                />
              ) : null}
              {rollbackInventory?.latest_git_branch ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Branch: ${rollbackInventory.latest_git_branch}`}
                />
              ) : null}
              {rollbackInventory?.invalid_count > 0 ? (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`Битых manifest'ов: ${rollbackInventory.invalid_count}`}
                />
              ) : null}
            </Stack>
            {formatRollbackMeta(rollbackInventory) ? (
              <Typography variant="body2" color="text.secondary">
                {formatRollbackMeta(rollbackInventory)}
              </Typography>
            ) : null}
            {rollbackInventory?.recent_labels?.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {rollbackInventory.recent_labels.map((label) => (
                  <Chip key={label} size="small" variant="outlined" label={label} />
                ))}
              </Stack>
            ) : null}
            {rollbackInventory?.error ? (
              <Typography variant="caption" color="error">
                {rollbackInventory.error}
              </Typography>
            ) : null}
            {rollbackInventory?.healthy &&
            rollbackInventory?.latest_source_metadata_available === false ? (
              <Typography variant="caption" color="warning.main">
                У последнего rollback snapshot нет source metadata. Следующий штатный deploy должен
                переснять recovery point.
              </Typography>
            ) : null}
            {rollbackInventory?.last_run?.status &&
            rollbackInventory.last_run.status !== "missing" ? (
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Stack spacing={0.4}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Последний rollback
                    </Typography>
                    <Chip
                      size="small"
                      color={getJobStatusChip(rollbackInventory.last_run).color}
                      label={getJobStatusChip(rollbackInventory.last_run).label}
                    />
                  </Stack>
                  {formatJobMeta(rollbackInventory.last_run) ? (
                    <Typography variant="caption" color="text.secondary">
                      {formatJobMeta(rollbackInventory.last_run)}
                    </Typography>
                  ) : null}
                  {rollbackInventory.last_run.summary ? (
                    <Typography variant="caption" color="text.secondary">
                      {rollbackInventory.last_run.summary}
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Rollback ещё не запускался после включения persisted status.
              </Typography>
            )}
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
            <Typography variant="body2">SLA:</Typography>
            <Typography variant="body2" color="text.secondary">
              Ответ {statusData?.sla?.response_minutes ?? settingsData.sla_response_minutes} мин,
              завершение {statusData?.sla?.completion_hours ?? settingsData.sla_completion_hours} ч
            </Typography>
          </Stack>
          {jobStatusEntries.length ? (
            <Stack spacing={1}>
              <Typography variant="body2">Фоновые задачи:</Typography>
              {jobStatusEntries.map(({ key, label, job }) => {
                const chip = getJobStatusChip(job);
                return (
                  <Paper key={key} variant="outlined" sx={{ p: 1.2 }}>
                    <Stack spacing={0.4}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {label}
                        </Typography>
                        <Chip size="small" color={chip.color} label={chip.label} />
                      </Stack>
                      {formatJobMeta(job) ? (
                        <Typography variant="caption" color="text.secondary">
                          {formatJobMeta(job)}
                        </Typography>
                      ) : null}
                      {job.summary ? (
                        <Typography variant="caption" color="text.secondary">
                          {job.summary}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : null}
          {statusData?.database?.error ? (
            <Alert severity="error">{statusData.database.error}</Alert>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" mb={1}>
          Реквизиты и системные настройки
        </Typography>
        <Stack spacing={1.5}>
          {settingsError ? <Alert severity="error">{settingsError}</Alert> : null}
          {settingsSuccess ? <Alert severity="success">{settingsSuccess}</Alert> : null}

          <TextField
            label="Банковские реквизиты"
            multiline
            minRows={2}
            value={settingsData.bank_requisites}
            onChange={(event) =>
              setSettingsData((prev) => ({ ...prev, bank_requisites: event.target.value }))
            }
          />
          <TextField
            label="Криптореквизиты"
            multiline
            minRows={2}
            value={settingsData.crypto_requisites}
            onChange={(event) =>
              setSettingsData((prev) => ({ ...prev, crypto_requisites: event.target.value }))
            }
          />
          <TextField
            label="Инструкция для клиента"
            multiline
            minRows={3}
            value={settingsData.instructions}
            onChange={(event) =>
              setSettingsData((prev) => ({ ...prev, instructions: event.target.value }))
            }
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="SLA ответ (мин)"
              type="number"
              value={settingsData.sla_response_minutes}
              onChange={(event) =>
                setSettingsData((prev) => ({
                  ...prev,
                  sla_response_minutes: Number(event.target.value || 0),
                }))
              }
            />
            <TextField
              label="SLA завершение (ч)"
              type="number"
              value={settingsData.sla_completion_hours}
              onChange={(event) =>
                setSettingsData((prev) => ({
                  ...prev,
                  sla_completion_hours: Number(event.target.value || 0),
                }))
              }
            />
          </Stack>

          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" mb={1}>
          Сервисные действия
        </Typography>
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
              {actionResult.success ? "Успешно" : "С ошибкой"} |{" "}
              {actionResult.action || "неизвестно"} | {actionResult.duration_seconds ?? "-"} сек
            </Alert>
            <Typography
              component="pre"
              sx={{ whiteSpace: "pre-wrap", m: 0, fontFamily: "monospace", fontSize: 13 }}
            >
              {outputText || "Вывод отсутствует"}
            </Typography>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
