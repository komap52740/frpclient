import RefreshIcon from "@mui/icons-material/Refresh";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Button,
  Chip,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import useAutoRefresh from "../../hooks/useAutoRefresh";

function computeUrgencyScore(item) {
  let score = 0;
  const unread = item.unread_count || 0;
  score += unread * 1000;

  if (item.sla_breached) {
    score += 1_000_000;
  }

  const deadline = item.completion_deadline_at || item.response_deadline_at;
  if (deadline) {
    const minutesLeft = dayjs(deadline).diff(dayjs(), "minute");
    if (minutesLeft <= 0) {
      score += 800_000;
    } else if (minutesLeft <= 15) {
      score += 500_000;
    } else if (minutesLeft <= 60) {
      score += 250_000;
    } else if (minutesLeft <= 180) {
      score += 120_000;
    }
  }

  if (item.status === "PAYMENT_PROOF_UPLOADED") {
    score += 300_000;
  }
  if (item.status === "IN_PROGRESS") {
    score += 200_000;
  }

  return score;
}

function sortByUrgency(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = computeUrgencyScore(b) - computeUrgencyScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });
}

function isUrgent(item) {
  if (item.sla_breached) {
    return true;
  }
  if ((item.unread_count || 0) > 0) {
    return true;
  }
  const deadline = item.completion_deadline_at || item.response_deadline_at;
  if (!deadline) {
    return false;
  }
  return dayjs(deadline).diff(dayjs(), "minute") <= 60;
}

export default function MasterActivePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusMode, setFocusMode] = useState("urgent");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const [appointmentsResponse, summaryData] = await Promise.all([appointmentsApi.activeList(), authApi.dashboardSummary()]);
      setItems(sortByUrgency(appointmentsResponse.data || []));
      setSummary(summaryData.counts || {});
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить активные заявки");
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

  const urgentItems = useMemo(() => items.filter(isUrgent), [items]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = focusMode === "urgent" ? urgentItems : items;
    if (!query) return base;
    return base.filter((item) => {
      const haystack = [item.brand, item.model, item.description, item.client_username, item.assigned_master_username]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [focusMode, items, searchQuery, urgentItems]);

  const focusItem = visibleItems[0] || items[0] || null;

  const focusDeadline = useMemo(() => {
    if (!focusItem) return null;
    const deadline = focusItem.completion_deadline_at || focusItem.response_deadline_at;
    if (!deadline) return null;
    const minutesLeft = dayjs(deadline).diff(dayjs(), "minute");
    return minutesLeft;
  }, [focusItem]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Активные заявки</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={urgentItems.length ? "error" : "default"}
            variant={urgentItems.length ? "filled" : "outlined"}
            label={`Срочные: ${urgentItems.length}`}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Обновить
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.4, borderRadius: 2.2 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Tabs
              value={focusMode}
              onChange={(_, value) => setFocusMode(value)}
              sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, textTransform: "none", fontWeight: 700 } }}
            >
              <Tab value="urgent" label={`Срочные (${urgentItems.length})`} />
              <Tab value="all" label={`Все (${items.length})`} />
            </Tabs>
            {focusItem ? (
              <Button variant="contained" size="small" onClick={() => navigate(`/appointments/${focusItem.id}`)}>
                Открыть ключевую заявку
              </Button>
            ) : null}
          </Stack>

          <TextField
            size="small"
            placeholder="Поиск по модели, описанию или клиенту"
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

          <Typography variant="caption" color="text.secondary">
            Сначала отображаются заявки с риском SLA и непрочитанными сообщениями.
          </Typography>
        </Stack>
      </Paper>

      {focusItem ? (
        <Paper sx={{ p: 1.5, borderRadius: 2.2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
            <Stack spacing={0.4}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Фокус: заявка #{focusItem.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {focusItem.brand} {focusItem.model}
              </Typography>
              <Typography variant="caption" color={focusDeadline != null && focusDeadline <= 0 ? "error.main" : "text.secondary"}>
                {focusDeadline == null
                  ? "Без SLA-дедлайна"
                  : focusDeadline <= 0
                    ? "SLA уже нарушен"
                    : `До SLA: ~${focusDeadline} мин`}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => navigate(`/appointments/${focusItem.id}?focus=chat`)}>
                К чату
              </Button>
              <Button variant="contained" size="small" onClick={() => navigate(`/appointments/${focusItem.id}`)}>
                Открыть карточку
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Grid container spacing={2} sx={{ width: "100%", m: 0, minWidth: 0 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Всего активных" value={summary?.active_total ?? "-"} accent="#15616d" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Ждут подтверждение" value={summary?.awaiting_payment_confirmation ?? "-"} accent="#bf4342" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="В процессе" value={summary?.in_progress ?? "-"} accent="#2e8a66" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Непрочитанные" value={summary?.unread_total ?? "-"} accent="#7b2cbf" />
        </Grid>
      </Grid>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !items.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : visibleItems.length ? (
        <Stack spacing={1.25}>
          {visibleItems.map((item) => (
            <AppointmentCard key={item.id} item={item} role="master" linkTo={`/appointments/${item.id}`} />
          ))}
        </Stack>
      ) : (
        <EmptyState title="Сейчас нет активных заявок" description="Возьмите новую заявку в разделе «Новые заявки», и она появится здесь." />
      )}
    </Stack>
  );
}
