import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import useAutoRefresh from "../../hooks/useAutoRefresh";

export default function MasterNewPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Новые заявки</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

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

      {items.length ? (
        <Stack spacing={1.25}>
          {items.map((item) => (
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
