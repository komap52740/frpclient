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
  Chip,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi, authApi } from "../../api/client";
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

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const [appointmentsResponse, summaryData] = await Promise.all([
        appointmentsApi.activeList(),
        authApi.dashboardSummary(),
      ]);
      const ordered = sortByUrgency(appointmentsResponse.data || []);
      setItems(ordered);
      setSummary(summaryData.counts || {});
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
      return;
    }
    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0].id);
    }
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
