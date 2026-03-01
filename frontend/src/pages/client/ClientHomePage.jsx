import AddTaskIcon from "@mui/icons-material/AddTask";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { Alert, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { appointmentsApi, authApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import useAutoRefresh from "../../hooks/useAutoRefresh";

export default function ClientHomePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [latestAppointments, setLatestAppointments] = useState([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      const [summaryData, appointmentsResponse] = await Promise.all([
        authApi.dashboardSummary(),
        appointmentsApi.my(),
      ]);
      setSummary(summaryData.counts || {});
      setLatestAppointments((appointmentsResponse.data || []).slice(0, 3));
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить дашборд клиента");
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(() => loadData({ silent: true }), { intervalMs: 7000 });

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #1f7a8c 0%, #2e8a66 100%)",
          color: "#fff",
        }}
      >
        <Typography variant="h5" mb={1}>Личный кабинет клиента</Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Вся работа по заявке проходит в одном месте: статусы, оплата, чат и история действий.
        </Typography>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Всего заявок" value={summary?.appointments_total ?? "-"} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Активные" value={summary?.appointments_active ?? "-"} accent="#2e8a66" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Ожидают оплату" value={summary?.awaiting_payment ?? "-"} accent="#c97a00" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Завершены" value={summary?.completed ?? "-"} accent="#006d77" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard title="Непрочитанные" value={summary?.unread_total ?? "-"} accent="#7b2cbf" />
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button component={RouterLink} to="/client/create" variant="contained" startIcon={<AddTaskIcon />}>
          Новая заявка
        </Button>
        <Button component={RouterLink} to="/client/my" variant="outlined" startIcon={<ListAltIcon />}>
          Все мои заявки
        </Button>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h6" mb={1}>Последние заявки</Typography>
        {latestAppointments.length ? (
          <Stack spacing={1.25}>
            {latestAppointments.map((item) => (
              <AppointmentCard key={item.id} item={item} role="client" linkTo={`/appointments/${item.id}`} />
            ))}
          </Stack>
        ) : (
          <EmptyState
            title="Пока нет заявок"
            description="Создайте первую заявку, и мастер сможет взять ее в работу."
            actionLabel="Создать заявку"
            onAction={() => navigate("/client/create")}
          />
        )}
      </Paper>
    </Stack>
  );
}
