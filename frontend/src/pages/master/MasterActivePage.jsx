import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";

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

export default function MasterActivePage() {
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
        appointmentsApi.activeList(),
        authApi.dashboardSummary(),
      ]);
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

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Активные заявки</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Grid container spacing={2}>
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

      <Paper sx={{ p: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Порядок заявок: сначала риск SLA, затем близость дедлайна и непрочитанные сообщения.
        </Typography>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !items.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : items.length ? (
        <Stack spacing={1.25}>
          {items.map((item) => (
            <AppointmentCard key={item.id} item={item} role="master" linkTo={`/appointments/${item.id}`} />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="Сейчас нет активных заявок"
          description="Возьмите новую заявку в разделе «Новые заявки», и она появится здесь."
        />
      )}
    </Stack>
  );
}
