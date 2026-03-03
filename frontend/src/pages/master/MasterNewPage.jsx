import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Button, Chip, Grid, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import useAutoRefresh from "../../hooks/useAutoRefresh";

function sortNewItems(items) {
  return [...items].sort((a, b) => {
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) {
      return unreadDiff;
    }
    const riskWeight = { critical: 3, high: 2, medium: 1, low: 0 };
    const riskDiff = (riskWeight[b.client_risk_level] || 0) - (riskWeight[a.client_risk_level] || 0);
    if (riskDiff !== 0) {
      return riskDiff;
    }
    if (Boolean(b.is_wholesale_request) !== Boolean(a.is_wholesale_request)) {
      return b.is_wholesale_request ? 1 : -1;
    }
    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });
}

function isPriorityItem(item) {
  return (
    (item.unread_count || 0) > 0 ||
    item.client_risk_level === "critical" ||
    item.client_risk_level === "high" ||
    Boolean(item.is_wholesale_request)
  );
}

export default function MasterNewPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("priority");

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const [appointmentsResponse, summaryData] = await Promise.all([
        appointmentsApi.newList(),
        authApi.dashboardSummary(),
      ]);
      setItems(appointmentsResponse.data || []);
      setSummary(summaryData.counts || {});
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить новые заявки");
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

  const sortedItems = useMemo(() => sortNewItems(items), [items]);
  const priorityItems = useMemo(() => sortedItems.filter(isPriorityItem), [sortedItems]);
  const visibleItems = useMemo(() => {
    if (viewMode === "priority") {
      return priorityItems.length ? priorityItems : sortedItems;
    }
    return sortedItems;
  }, [priorityItems, sortedItems, viewMode]);
  const focusItem = priorityItems[0] || sortedItems[0] || null;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Новые заявки</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={priorityItems.length ? "warning" : "default"}
            label={`Фокус: ${priorityItems.length}`}
            variant={priorityItems.length ? "filled" : "outlined"}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Обновить
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.4, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Tabs
              value={viewMode}
              onChange={(_, value) => setViewMode(value)}
              sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, textTransform: "none", fontWeight: 700 } }}
            >
              <Tab value="priority" label={`Приоритет (${priorityItems.length})`} />
              <Tab value="all" label={`Все (${items.length})`} />
            </Tabs>
            {focusItem ? (
              <Button variant="contained" size="small" onClick={() => navigate(`/appointments/${focusItem.id}`)}>
                Открыть главную заявку
              </Button>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            В приоритете заявки с непрочитанными сообщениями, повышенным риском и оптовой пометкой.
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard title="Доступно новых" value={summary?.new_available ?? "-"} accent="#15616d" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard title="Активно в работе" value={summary?.active_total ?? "-"} accent="#2e8a66" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard title="Ожидают оплату" value={summary?.awaiting_client_payment ?? "-"} accent="#c97a00" />
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="body2" color="text.secondary">
          В новых заявках действует модель «кто первый взял — тот ведет заказ».
        </Typography>
      </Paper>

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
        <EmptyState
          title="Новых заявок пока нет"
          description="Проверьте раздел позже или обновите список вручную."
          actionLabel="Обновить"
          onAction={load}
        />
      )}
    </Stack>
  );
}
