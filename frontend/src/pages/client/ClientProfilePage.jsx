import { Paper, Stack, Typography } from "@mui/material";

import { useAuth } from "../../auth/AuthContext";

export default function ClientProfilePage() {
  const { user } = useAuth();
  const stats = user?.client_stats;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Профиль клиента</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">Логин: {user?.username}</Typography>
        <Typography variant="body1">Завершено: {stats?.completed_orders_count || 0}</Typography>
        <Typography variant="body1">Отменено: {stats?.cancelled_orders_count || 0}</Typography>
        <Typography variant="body1">Средняя оценка: {stats?.average_rating || 0}</Typography>
        <Typography variant="body1">Доля отмен: {stats?.cancellation_rate || 0}</Typography>
      </Paper>
    </Stack>
  );
}
