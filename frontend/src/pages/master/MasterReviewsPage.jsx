import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

import EmptyState from "../../components/EmptyState";
import { useMasterQueueRealtime } from "../../features/appointments/master-inbox/hooks/useMasterQueueRealtime";
import { useMasterReviewsQuery } from "../../features/reviews/hooks/useReviewQueries";
import { queryKeys } from "../../shared/api/queryKeys";

dayjs.locale("ru");

function ratingTone(rating, isDark) {
  if (rating >= 5)
    return {
      color: isDark ? "#77e2ac" : "#087443",
      bg: isDark ? "rgba(30,88,61,0.42)" : "#e8f7ef",
    };
  if (rating >= 4)
    return {
      color: isDark ? "#8ac8ff" : "#0f6ba8",
      bg: isDark ? "rgba(20,52,82,0.42)" : "#e9f2ff",
    };
  if (rating >= 3)
    return { color: isDark ? "#ffd98f" : "#9a6700", bg: isDark ? "rgba(87,63,22,0.4)" : "#fff8e1" };
  return { color: isDark ? "#ff9a94" : "#b42318", bg: isDark ? "rgba(101,31,35,0.45)" : "#fee4e2" };
}

function matchesQuery(row, query) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const haystack = [String(row.appointment || ""), row.author_username || "", row.comment || ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

export default function MasterReviewsPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isDark = theme.palette.mode === "dark";
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [onlyWithComment, setOnlyWithComment] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const { data: rows = [], isPending, isFetching, error, refetch } = useMasterReviewsQuery();
  const loading = isPending;
  const refreshing = isFetching;
  const errorMessage = error ? "Не удалось загрузить отзывы" : "";

  const refreshData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const invalidateData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.myRoot() });
  }, [queryClient]);

  useMasterQueueRealtime({
    onConnected: invalidateData,
    onQueueEvent: invalidateData,
  });

  const filteredRows = useMemo(() => {
    const min = Number(minRating || 0);
    return rows
      .filter((row) => (row.rating || 0) >= min)
      .filter((row) => (onlyWithComment ? Boolean((row.comment || "").trim()) : true))
      .filter((row) => matchesQuery(row, deferredQuery))
      .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  }, [deferredQuery, minRating, onlyWithComment, rows]);

  const avg = filteredRows.length
    ? (filteredRows.reduce((sum, row) => sum + (row.rating || 0), 0) / filteredRows.length).toFixed(
        1
      )
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
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={refreshData}
          disabled={refreshing}
        >
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
            sx={{
              bgcolor: isDark ? "rgba(24,84,58,0.45)" : "#ecfdf3",
              color: isDark ? "#77e2ac" : "#027a48",
            }}
          />
          <Chip
            size="small"
            icon={<ReportProblemRoundedIcon fontSize="small" />}
            label={`Риск-отзывы: ${riskCount}`}
            sx={{
              bgcolor: isDark ? "rgba(101,31,35,0.45)" : "#fee4e2",
              color: isDark ? "#ff9a94" : "#b42318",
            }}
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
          control={
            <Switch
              checked={onlyWithComment}
              onChange={(event) => setOnlyWithComment(event.target.checked)}
            />
          }
          label="Только с текстовым комментарием"
        />
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

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
            const tone = ratingTone(row.rating || 0, isDark);
            return (
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
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
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
