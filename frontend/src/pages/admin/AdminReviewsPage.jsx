import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Alert,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import useAutoRefresh from "../../hooks/useAutoRefresh";

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

const MIN_RATINGS = [
  { value: "0", label: "Любая оценка" },
  { value: "5", label: "Только 5" },
  { value: "4", label: "От 4" },
  { value: "3", label: "От 3" },
  { value: "2", label: "От 2" },
  { value: "1", label: "От 1" },
];

function applyClientFilters(rows, { query, minRating }) {
  const normalizedQuery = (query || "").trim().toLowerCase();
  const min = Number(minRating || 0);

  return rows
    .filter((row) => (row.rating || 0) >= min)
    .filter((row) => {
      if (!normalizedQuery) return true;
      const haystack = [
        String(row.appointment || ""),
        row.author_username || "",
        row.target_username || "",
        row.comment || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
}

export default function AdminReviewsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    review_type: "",
    target_role: "",
    min_rating: "0",
    query: "",
  });

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const response = await adminApi.reviews({
        review_type: filters.review_type || undefined,
        target_role: filters.target_role || undefined,
      });
      setRows(response.data || []);
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить отзывы");
      }
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }, [filters.review_type, filters.target_role]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true, withLoading: false }), { intervalMs: 18000 });

  const filteredRows = useMemo(
    () => applyClientFilters(rows, { query: filters.query, minRating: filters.min_rating }),
    [filters.min_rating, filters.query, rows]
  );

  const avg = filteredRows.length
    ? (filteredRows.reduce((sum, row) => sum + (row.rating || 0), 0) / filteredRows.length).toFixed(1)
    : null;
  const lowCount = filteredRows.filter((row) => (row.rating || 0) <= 2).length;
  const todayCount = filteredRows.filter((row) => dayjs(row.created_at).isAfter(dayjs().startOf("day"))).length;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">Отзывы платформы</Typography>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => load()} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Записей: ${filteredRows.length}`} />
          <Chip
            size="small"
            icon={<StarRoundedIcon fontSize="small" />}
            label={avg ? `Средняя: ${avg}` : "Средняя: —"}
            color="primary"
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Низкие (<=2): ${lowCount}`}
            sx={{ bgcolor: isDark ? "rgba(101,31,35,0.45)" : "#fee4e2", color: isDark ? "#ff9a94" : "#b42318" }}
          />
          <Chip
            size="small"
            label={`Сегодня: ${todayCount}`}
            sx={{ bgcolor: isDark ? "rgba(20,52,82,0.42)" : "#e9f2ff", color: isDark ? "#8ac8ff" : "#0f6ba8" }}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            select
            label="Тип отзыва"
            value={filters.review_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, review_type: event.target.value }))}
            sx={{ minWidth: { xs: "100%", md: 220 } }}
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
            sx={{ minWidth: { xs: "100%", md: 200 } }}
          >
            {TARGET_ROLES.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Минимальная оценка"
            value={filters.min_rating}
            onChange={(event) => setFilters((prev) => ({ ...prev, min_rating: event.target.value }))}
            sx={{ minWidth: { xs: "100%", md: 190 } }}
          >
            {MIN_RATINGS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label="Поиск"
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
            placeholder="Заявка, автор, получатель, комментарий"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" onClick={() => load()} sx={{ alignSelf: { xs: "stretch", md: "center" } }}>
            Применить серверный фильтр
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!filteredRows.length && !loading ? (
        <EmptyState
          title={rows.length ? "По фильтрам ничего не найдено" : "Отзывов нет"}
          description={
            rows.length
              ? "Измените поиск или порог оценки, чтобы увидеть результаты."
              : "Здесь появятся отзывы после завершения заявок."
          }
        />
      ) : (
        <Stack spacing={1.1}>
          {filteredRows.map((row) => (
            <Paper
              key={row.id}
              sx={{
                p: 1.5,
                borderRadius: 3,
                background: isDark
                  ? "linear-gradient(150deg, rgba(15,23,42,0.9) 0%, rgba(17,30,48,0.86) 100%)"
                  : "linear-gradient(150deg, rgba(255,255,255,0.96) 0%, rgba(247,251,255,0.92) 100%)",
              }}
            >
              <Stack spacing={0.6}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2">Заявка #{row.appointment}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.review_type === "master_review" ? "Клиент -> Мастер" : "Мастер -> Клиент"}
                    </Typography>
                  </Stack>
                <Stack direction="row" spacing={0.6} alignItems="center">
                    <StarRoundedIcon sx={{ fontSize: 18, color: isDark ? "#ffd166" : "#f59e0b" }} />
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
