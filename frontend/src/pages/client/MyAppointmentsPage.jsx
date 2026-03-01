import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import useAutoRefresh from "../../hooks/useAutoRefresh";

export default function MyAppointmentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const response = await appointmentsApi.my();
      setItems(response.data || []);
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить список заявок");
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

  useAutoRefresh(() => load({ silent: true, withLoading: false }), { intervalMs: 6000 });

  const unreadTotal = useMemo(() => items.reduce((sum, item) => sum + (item.unread_count || 0), 0), [items]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography variant="h5">Мои заявки</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Всего заявок: {items.length} | Непрочитанных сообщений: {unreadTotal}
        </Typography>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {items.length ? (
        <Stack spacing={1.25}>
          {items.map((item) => (
            <AppointmentCard key={item.id} item={item} linkTo={`/appointments/${item.id}`} />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="Список заявок пуст"
          description="Создайте новую заявку, и она появится в этом разделе."
          actionLabel="Создать заявку"
          onAction={() => navigate("/client/create")}
        />
      )}
    </Stack>
  );
}
