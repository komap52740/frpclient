import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useState } from "react";

import { adminApi } from "../../api/client";
import EmptyState from "../../components/EmptyState";

dayjs.locale("ru");

const REVIEW_TYPES = [
  { value: "", label: "Все типы" },
  { value: "master_review", label: "Клиент -> Мастер" },
  { value: "client_review", label: "Мастер -> Клиент" },
];

const TARGET_ROLES = [
  { value: "", label: "Все роли" },
  { value: "master", label: "Мастер" },
  { value: "client", label: "Клиент" },
  { value: "admin", label: "Админ" },
];

export default function AdminReviewsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    review_type: "",
    target_role: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminApi.reviews(filters);
      setRows(response.data || []);
      setError("");
    } catch {
      setError("Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">Отзывы платформы</Typography>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            select
            label="Тип отзыва"
            value={filters.review_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, review_type: event.target.value }))}
            sx={{ minWidth: 220 }}
          >
            {REVIEW_TYPES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Кому адресован"
            value={filters.target_role}
            onChange={(event) => setFilters((prev) => ({ ...prev, target_role: event.target.value }))}
            sx={{ minWidth: 200 }}
          >
            {TARGET_ROLES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <Button variant="contained" onClick={load} sx={{ alignSelf: { xs: "stretch", md: "center" } }}>
            Применить фильтр
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!rows.length && !loading ? (
        <EmptyState
          title="Отзывов нет"
          description="Здесь появятся отзывы после завершения заявок."
        />
      ) : (
        <Stack spacing={1.1}>
          {rows.map((row) => (
            <Paper key={row.id} sx={{ p: 1.5 }}>
              <Stack spacing={0.6}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2">Заявка #{row.appointment}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.review_type === "master_review" ? "Клиент -> Мастер" : "Мастер -> Клиент"}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <StarRoundedIcon sx={{ fontSize: 18, color: "#f59e0b" }} />
                    <Typography variant="subtitle2">{row.rating}/5</Typography>
                  </Stack>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  От: {row.author_username || row.author} | Кому: {row.target_username || row.target}
                </Typography>

                {row.comment ? (
                  <Typography variant="body2">{row.comment}</Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Комментарий не указан.
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  {dayjs(row.created_at).format("DD.MM.YYYY HH:mm")}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
