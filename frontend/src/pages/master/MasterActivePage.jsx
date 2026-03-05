import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  InputAdornment,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminApi, appointmentsApi, authApi } from "../../api/client";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import { getStatusLabel } from "../../constants/labels";
import useAutoRefresh from "../../hooks/useAutoRefresh";

const FILTERS = [
  { key: "urgent", label: "Срочные", hotkey: "Alt+1" },
  { key: "unread", label: "Непрочитанные", hotkey: "Alt+2" },
  { key: "payment", label: "Оплата", hotkey: "Alt+3" },
  { key: "sla", label: "SLA", hotkey: "Alt+4" },
  { key: "pro", label: "Service PRO", hotkey: "Alt+5" },
  { key: "all", label: "Все", hotkey: "Alt+6" },
];

const BULK_ACTION_OPTIONS = [
  { value: "send_template", label: "Шаблонный ответ" },
  { value: "start_work", label: "Старт работы (PAID -> IN_PROGRESS)" },
  { value: "complete_work", label: "Завершить работу (IN_PROGRESS -> COMPLETED)" },
];

function computeUrgencyScore(item) {
  let score = 0;
  score += (item.unread_count || 0) * 1000;
  if (item.sla_breached) {
    score += 1_000_000;
  }

  const deadline = item.completion_deadline_at || item.response_deadline_at;
  if (deadline) {
    const minutesLeft = dayjs(deadline).diff(dayjs(), "minute");
    if (minutesLeft <= 0) score += 800_000;
    else if (minutesLeft <= 15) score += 500_000;
    else if (minutesLeft <= 60) score += 250_000;
    else if (minutesLeft <= 180) score += 120_000;
  }

  if (item.status === "PAYMENT_PROOF_UPLOADED") score += 300_000;
  if (item.status === "IN_PROGRESS") score += 200_000;
  return score;
}

function sortByUrgency(items) {
  return [...items].sort((a, b) => {
    const diff = computeUrgencyScore(b) - computeUrgencyScore(a);
    if (diff !== 0) return diff;
    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });
}

function getMessagePreview(item) {
  const text = (item.latest_message_text || "").trim();
  if (text) return text;
  if (item.latest_message_created_at) return "Последнее сообщение без текста";
  return "Пока нет сообщений";
}

function getPriorityUi(priority) {
  if (priority === "critical") {
    return { color: "error", label: "PRO: критический" };
  }
  if (priority === "priority") {
    return { color: "warning", label: "PRO: приоритет" };
  }
  return { color: "default", label: "PRO: стандарт" };
}

function formatRub(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function formatDuration(valueSeconds) {
  const seconds = Number(valueSeconds || 0);
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} мин`;
}

function matchFilter(item, filterKey) {
  const unread = item.unread_count || 0;
  const deadline = item.completion_deadline_at || item.response_deadline_at;
  const minutesLeft = deadline ? dayjs(deadline).diff(dayjs(), "minute") : null;

  if (filterKey === "urgent") {
    return item.sla_breached || unread > 0 || (minutesLeft != null && minutesLeft <= 60);
  }
  if (filterKey === "unread") {
    return unread > 0;
  }
  if (filterKey === "payment") {
    return item.status === "AWAITING_PAYMENT" || item.status === "PAYMENT_PROOF_UPLOADED";
  }
  if (filterKey === "sla") {
    return item.sla_breached || (minutesLeft != null && minutesLeft <= 60);
  }
  if (filterKey === "pro") {
    return Boolean(item.client_service_center_pro);
  }
  return true;
}

export default function MasterActivePage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterKey, setFilterKey] = useState("urgent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("send_template");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const [appointmentsResponse, summaryData, financeResponse, weeklyResponse] = await Promise.allSettled([
        appointmentsApi.activeList(),
        authApi.dashboardSummary(),
        adminApi.financeSummary(),
        adminApi.weeklyReport(),
      ]);
      if (appointmentsResponse.status !== "fulfilled" || summaryData.status !== "fulfilled") {
        throw new Error("failed_to_load_master_dashboard");
      }
      const ordered = sortByUrgency(appointmentsResponse.value.data || []);
      setItems(ordered);
      setSummary(summaryData.value.counts || {});
      if (financeResponse.status === "fulfilled") {
        setFinanceSummary(financeResponse.value.data || null);
      }
      if (weeklyResponse.status === "fulfilled") {
        setWeeklyReport(weeklyResponse.value.data || null);
      }
      setError("");
      setSelectedId((prev) => prev ?? ordered[0]?.id ?? null);
    } catch {
      if (!silent) {
        setError("Не удалось загрузить рабочий стол мастера");
      }
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true, withLoading: false }), { intervalMs: 5000 });

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => matchFilter(item, filterKey));
    if (!query) return filtered;
    return filtered.filter((item) => {
      const haystack = [
        item.brand,
        item.model,
        item.description,
        item.client_username,
        item.status,
        item.latest_message_text,
        item.latest_message_sender_username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filterKey, items, searchQuery]);

  const selectedItem = useMemo(() => {
    return visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null;
  }, [selectedId, visibleItems]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }
    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0].id);
    }
    setSelectedIds((prev) => prev.filter((id) => visibleItems.some((item) => item.id === id)));
  }, [selectedId, visibleItems]);

  useEffect(() => {
    const handler = (event) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.altKey && /^[1-6]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const nextFilter = FILTERS[index]?.key;
        if (nextFilter) {
          event.preventDefault();
          setFilterKey(nextFilter);
        }
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (isTypingTarget) {
        return;
      }

      if (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k") {
        if (!visibleItems.length || !selectedItem) return;
        event.preventDefault();
        const currentIndex = visibleItems.findIndex((item) => item.id === selectedItem.id);
        if (currentIndex < 0) return;
        const offset = event.key.toLowerCase() === "j" ? 1 : -1;
        const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, currentIndex + offset));
        setSelectedId(visibleItems[nextIndex].id);
        return;
      }

      if (event.key === "Enter" && selectedItem) {
        event.preventDefault();
        navigate(`/appointments/${selectedItem.id}`);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, selectedItem, visibleItems]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(item.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleItems.some((item) => item.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  const toggleSelectOne = (appointmentId) => {
    setSelectedIds((prev) => {
      if (prev.includes(appointmentId)) {
        return prev.filter((id) => id !== appointmentId);
      }
      return [...prev, appointmentId];
    });
  };

  const runBulkAction = async () => {
    if (!selectedCount || bulkBusy) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const payload = {
        appointment_ids: selectedIds,
        action: bulkAction,
        message_text: bulkMessage,
      };
      const response = await appointmentsApi.bulkAction(payload);
      setBulkResult(response.data || null);
      if (bulkAction === "send_template") {
        setBulkMessage("");
      }
      await load({ silent: true, withLoading: false });
    } catch (requestError) {
      setBulkResult({
        error: requestError?.response?.data?.detail || "Не удалось выполнить bulk-действие",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
        <Stack spacing={0.2}>
          <Typography variant="h5">Профессиональный inbox мастера</Typography>
          <Typography variant="body2" color="text.secondary">
            Единая лента активных чатов, фильтры и горячие клавиши.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" variant="outlined" label={`Активных: ${summary?.active_total ?? items.length}`} />
          <Button variant="outlined" size="small" startIcon={<RefreshRoundedIcon />} onClick={() => load()} disabled={loading}>
            Обновить
          </Button>
        </Stack>
      </Stack>

      {financeSummary ? (
        <Paper sx={{ p: 1.2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Финансовый блок
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" color="success" variant="outlined" label={`Оплачено: ${formatRub(financeSummary.paid_total)}`} />
              <Chip size="small" color="info" variant="outlined" label={`В работе: ${formatRub(financeSummary.in_work_total)}`} />
              <Chip size="small" color="primary" variant="outlined" label={`За период: ${formatRub(financeSummary.period_total)}`} />
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {weeklyReport ? (
        <Paper sx={{ p: 1.2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Еженедельный отчет
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={`SLA нарушено: ${weeklyReport.sla_breached_count || 0}`} />
              <Chip size="small" variant="outlined" label={`Ответ: ${formatDuration(weeklyReport.avg_first_response_seconds)}`} />
              <Chip size="small" variant="outlined" label={`Закрыто: ${weeklyReport.closed_count || 0}`} />
              <Chip
                size="small"
                color={(weeklyReport.problematic_cases_count || 0) > 0 ? "warning" : "default"}
                variant={(weeklyReport.problematic_cases_count || 0) > 0 ? "filled" : "outlined"}
                label={`Проблемные кейсы: ${weeklyReport.problematic_cases_count || 0}`}
              />
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 1.4, borderRadius: 2 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Bulk-действия по очереди
            </Typography>
            <Chip
              size="small"
              variant={selectedCount ? "filled" : "outlined"}
              color={selectedCount ? "primary" : "default"}
              label={`Выбрано: ${selectedCount}`}
            />
            <Button size="small" variant="outlined" onClick={toggleSelectAllVisible}>
              {allVisibleSelected ? "Снять выделение" : "Выбрать все в фильтре"}
            </Button>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 300 } }}>
              <InputLabel id="bulk-action-label">Действие</InputLabel>
              <Select
                labelId="bulk-action-label"
                label="Действие"
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
              >
                {BULK_ACTION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Текст сообщения (для шаблонного ответа)"
              value={bulkMessage}
              onChange={(event) => setBulkMessage(event.target.value)}
            />
            <Button
              variant="contained"
              disabled={bulkBusy || !selectedCount || (bulkAction === "send_template" && !bulkMessage.trim())}
              onClick={runBulkAction}
            >
              {bulkBusy ? "Выполняем..." : "Применить"}
            </Button>
          </Stack>
          {bulkResult?.error ? <Alert severity="error">{bulkResult.error}</Alert> : null}
          {bulkResult?.processed_count != null ? (
            <Alert severity="success">
              Обработано: {bulkResult.processed_count}. Пропущено: {bulkResult.skipped?.length || 0}.
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {FILTERS.map((filter) => (
              <Chip
                key={filter.key}
                label={`${filter.label}`}
                color={filterKey === filter.key ? "primary" : "default"}
                variant={filterKey === filter.key ? "filled" : "outlined"}
                onClick={() => setFilterKey(filter.key)}
              />
            ))}
          </Stack>
          <TextField
            inputRef={searchRef}
            size="small"
            placeholder="Поиск: модель, клиент, сообщение"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <KeyboardRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              Горячие клавиши: `Alt+1..6` фильтры, `J/K` навигация, `Enter` открыть, `/` поиск.
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {selectedItem ? (
        <Paper sx={{ p: 1.3, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
            <Stack spacing={0.4}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Фокус: заявка #{selectedItem.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedItem.brand} {selectedItem.model} • {selectedItem.client_username}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => navigate(`/appointments/${selectedItem.id}?focus=chat`)}>
                Открыть чат
              </Button>
              <Button variant="contained" size="small" onClick={() => navigate(`/appointments/${selectedItem.id}`)}>
                Открыть карточку
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {loading && !items.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : (
        <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
          {!visibleItems.length ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="info">В этом фильтре пока нет активных чатов.</Alert>
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {visibleItems.map((item) => {
                const selected = selectedItem?.id === item.id;
                const selectedInBulk = selectedIds.includes(item.id);
                const priorityUi = getPriorityUi(item.client_wholesale_priority);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 1.3,
                      bgcolor: selected ? "action.selected" : "transparent",
                      cursor: "pointer",
                      transition: "background-color .18s ease",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => navigate(`/appointments/${item.id}`)}
                  >
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
                      <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Checkbox
                            size="small"
                            checked={selectedInBulk}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelectOne(item.id)}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            #{item.id} • {item.brand} {item.model}
                          </Typography>
                          <Chip size="small" variant="outlined" label={getStatusLabel(item.status)} />
                          {item.sla_breached ? (
                            <Chip size="small" color="error" icon={<WarningAmberRoundedIcon />} label="SLA нарушен" />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Клиент: {item.client_username || "—"} • Обновлено: {dayjs(item.updated_at).format("DD.MM HH:mm")}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <b>{item.latest_message_sender_username || "Чат"}:</b> {getMessagePreview(item)}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant={item.unread_count ? "filled" : "outlined"}
                          color={item.unread_count ? "primary" : "default"}
                          icon={<ChatBubbleOutlineRoundedIcon />}
                          label={`Новых: ${item.unread_count || 0}`}
                        />
                        {item.client_service_center_pro ? (
                          <Chip size="small" color="success" icon={<StorefrontRoundedIcon />} label="Service PRO" />
                        ) : null}
                        {item.client_service_center_pro ? (
                          <Chip size="small" color={priorityUi.color} variant="outlined" label={priorityUi.label} />
                        ) : null}
                        <Button size="small" variant="outlined" onClick={() => navigate(`/appointments/${item.id}?focus=chat`)}>
                          К чату
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}
    </Stack>
  );
}
