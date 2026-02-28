import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Button, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";

export default function MasterActivePage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [appointmentsResponse, summaryData] = await Promise.all([
        appointmentsApi.activeList(),
        authApi.dashboardSummary(),
      ]);
      setItems(appointmentsResponse.data || []);
      setSummary(summaryData.counts || {});
      setError("");
    } catch {
      setError("Не удалось загрузить активные заявки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

      {error && <Alert severity="error">{error}</Alert>}

      {items.length ? (
        <Stack spacing={1.25}>
          {items.map((item) => (
            <AppointmentCard key={item.id} item={item} linkTo={`/appointments/${item.id}`} />
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
