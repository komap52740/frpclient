import AutorenewIcon from "@mui/icons-material/Autorenew";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
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

const ACTIONS = [
  { id: "check", label: "Проверка системы" },
  { id: "migrate", label: "Применить миграции" },
  { id: "collectstatic", label: "Собрать статику" },
  { id: "clearsessions", label: "Очистить сессии" },
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
      const rows = (response.data || []).slice().sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
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
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "text/csv;charset=utf-8" });
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

  const focusCards = useMemo(
    () => [
      { label: "Непрочитанные сигналы", value: unreadNotifications.length, color: unreadNotifications.length ? "error" : "default" },
      { label: "Опт-заявки на проверке", value: wholesalePendingCount, color: wholesalePendingCount ? "warning" : "default" },
      { label: "Платежи на подтверждении", value: Number(statusData?.appointments?.awaiting_payment_confirmation || 0), color: "info" },
    ],
    [statusData?.appointments?.awaiting_payment_confirmation, unreadNotifications.length, wholesalePendingCount]
  );

  const primaryOpsAction = useMemo(() => {
    if (unreadNotifications.length) {
      return { label: "Открыть заявки с сигналами", onClick: () => navigate("/admin/appointments") };
    }
    if (wholesalePendingCount > 0) {
      return { label: "Проверить опт-клиентов", onClick: () => navigate("/admin/clients") };
    }
    return { label: "Открыть системные правила", onClick: () => navigate("/admin/rules") };
  }, [navigate, unreadNotifications.length, wholesalePendingCount]);

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
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
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
        <Typography variant="h3" sx={{ mb: 1 }}>Финансовый блок</Typography>
        {financeSummary ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color="success" variant="outlined" label={`Оплачено: ${(financeSummary.paid_total || 0).toLocaleString("ru-RU")} ₽`} />
            <Chip size="small" color="info" variant="outlined" label={`В работе: ${(financeSummary.in_work_total || 0).toLocaleString("ru-RU")} ₽`} />
            <Chip size="small" color="primary" variant="outlined" label={`За период: ${(financeSummary.period_total || 0).toLocaleString("ru-RU")} ₽`} />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">Финансовая сводка недоступна.</Typography>
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
          <Button size="small" variant="contained" onClick={applyPaymentRegistryFilters} disabled={paymentRegistryLoading}>
            Обновить реестр
          </Button>
        </Stack>

        {paymentRegistryError ? <Alert severity="error" sx={{ mb: 1 }}>{paymentRegistryError}</Alert> : null}

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
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>#{row.appointment_id}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.status}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.total_price ? `${Number(row.total_price).toLocaleString("ru-RU")} ₽` : "Цена не указана"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{row.client_username || "—"}</TableCell>
                  <TableCell>{row.master_username || "—"}</TableCell>
                  <TableCell>
                    <Stack spacing={0.2}>
                      <Typography variant="body2">{row.payment_method_label || row.payment_method || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.payment_requisites_note || "Реквизиты не указаны"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {row.payment_proof_url ? (
                      <Button size="small" variant="text" href={row.payment_proof_url} target="_blank" rel="noreferrer">
                        Открыть чек
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Нет файла</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.2}>
                      <Typography variant="body2">{row.payment_confirmed_by_username || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.payment_confirmed_at ? dayjs(row.payment_confirmed_at).format("DD.MM.YYYY HH:mm") : "Не подтверждено"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Stack spacing={0.4}>
                      {(row.history || []).slice(0, 3).map((eventItem) => (
                        <Typography key={eventItem.id} variant="caption" color="text.secondary">
                          {dayjs(eventItem.created_at).format("DD.MM HH:mm")} — {eventItem.event_label || eventItem.event_type}
                          {" · "}
                          {eventItem.actor_username || "система"}
                        </Typography>
                      ))}
                      {!row.history?.length ? (
                        <Typography variant="caption" color="text.secondary">История пустая</Typography>
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
        <Typography variant="h3" sx={{ mb: 1 }}>Еженедельный отчет</Typography>
        {weeklyReport ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`SLA нарушено: ${weeklyReport.sla_breached_count || 0}`} />
            <Chip size="small" variant="outlined" label={`Средний ответ: ${Math.round((weeklyReport.avg_first_response_seconds || 0) / 60) || 0} мин`} />
            <Chip size="small" variant="outlined" label={`Закрытые заявки: ${weeklyReport.closed_count || 0}`} />
            <Chip
              size="small"
              color={(weeklyReport.problematic_cases_count || 0) > 0 ? "warning" : "default"}
              variant={(weeklyReport.problematic_cases_count || 0) > 0 ? "filled" : "outlined"}
              label={`Проблемные кейсы: ${weeklyReport.problematic_cases_count || 0}`}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">Недельный отчет недоступен.</Typography>
        )}
      </Paper>

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
