import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import {
  Alert,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";

import { reviewsApi } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import useAutoRefresh from "../../hooks/useAutoRefresh";

dayjs.locale("ru");

function ratingTone(rating) {
  if (rating >= 5) return { color: "#087443", bg: "#e8f7ef" };
  if (rating >= 4) return { color: "#0f6ba8", bg: "#e9f2ff" };
  if (rating >= 3) return { color: "#9a6700", bg: "#fff8e1" };
  return { color: "#b42318", bg: "#fee4e2" };
}

function matchesQuery(row, query) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const haystack = [
    String(row.appointment || ""),
    row.author_username || "",
    row.comment || "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

export default function MasterReviewsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [onlyWithComment, setOnlyWithComment] = useState(false);

  const load = useCallback(async ({ silent = false, withLoading = true } = {}) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const response = await reviewsApi.my();
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true, withLoading: false }), { intervalMs: 15000 });

  const filteredRows = useMemo(() => {
    const min = Number(minRating || 0);
    return rows
      .filter((row) => (row.rating || 0) >= min)
      .filter((row) => (onlyWithComment ? Boolean((row.comment || "").trim()) : true))
      .filter((row) => matchesQuery(row, query))
      .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  }, [minRating, onlyWithComment, query, rows]);

  const avg = filteredRows.length
    ? (filteredRows.reduce((sum, row) => sum + (row.rating || 0), 0) / filteredRows.length).toFixed(1)
    : null;
  const positiveCount = filteredRows.filter((row) => (row.rating || 0) >= 4).length;
  const riskCount = filteredRows.filter((row) => (row.rating || 0) <= 2).length;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">Отзывы о мастере</Typography>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => load()} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">
            Всего отзывов: {rows.length}
          </Typography>
          <Chip
            size="small"
            icon={<StarRoundedIcon fontSize="small" />}
            label={avg ? `Средняя оценка: ${avg}` : "Средняя оценка: —"}
            color="primary"
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<ThumbUpAltRoundedIcon fontSize="small" />}
            label={`Положительных: ${positiveCount}`}
            sx={{ bgcolor: "#ecfdf3", color: "#027a48" }}
          />
          <Chip
            size="small"
            icon={<ReportProblemRoundedIcon fontSize="small" />}
            label={`Риск-отзывы: ${riskCount}`}
            sx={{ bgcolor: "#fee4e2", color: "#b42318" }}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            fullWidth
            label="Поиск по отзывам"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Номер заявки, клиент, комментарий"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Минимальная оценка"
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 220 } }}
          >
            <MenuItem value="0">Любая</MenuItem>
            <MenuItem value="5">Только 5</MenuItem>
            <MenuItem value="4">От 4</MenuItem>
            <MenuItem value="3">От 3</MenuItem>
            <MenuItem value="2">От 2</MenuItem>
            <MenuItem value="1">От 1</MenuItem>
          </TextField>
        </Stack>

        <FormControlLabel
          sx={{ mt: 0.8 }}
          control={<Switch checked={onlyWithComment} onChange={(event) => setOnlyWithComment(event.target.checked)} />}
          label="Только с текстовым комментарием"
        />
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!filteredRows.length && !loading ? (
        <EmptyState
          title={rows.length ? "Фильтр ничего не нашел" : "Отзывов пока нет"}
          description={
            rows.length
              ? "Сбросьте фильтр или измените поиск, чтобы увидеть больше отзывов."
              : "После завершения заявок клиенты смогут оценить вашу работу."
          }
        />
      ) : (
        <Stack spacing={1.1}>
          {filteredRows.map((row) => {
            const tone = ratingTone(row.rating || 0);
            return (
              <Paper key={row.id} sx={{ p: 1.5 }}>
                <Stack spacing={0.6}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography variant="subtitle2">Заявка #{row.appointment}</Typography>
                      <Chip
                        size="small"
                        icon={<StarRoundedIcon fontSize="small" sx={{ color: tone.color }} />}
                        label={`${row.rating}/5`}
                        sx={{ bgcolor: tone.bg, color: tone.color }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(row.created_at).format("DD.MM.YYYY HH:mm")}
                    </Typography>
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    От клиента: {row.author_username || row.author}
                  </Typography>

                  {row.comment ? (
                    <Typography variant="body2">{row.comment}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Комментарий не указан.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
