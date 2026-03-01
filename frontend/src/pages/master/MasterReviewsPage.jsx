import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useState } from "react";

import { reviewsApi } from "../../api/client";
import EmptyState from "../../components/EmptyState";

dayjs.locale("ru");

function ratingTone(rating) {
  if (rating >= 5) return { color: "#087443", bg: "#e8f7ef" };
  if (rating >= 4) return { color: "#0f6ba8", bg: "#e9f2ff" };
  if (rating >= 3) return { color: "#9a6700", bg: "#fff8e1" };
  return { color: "#b42318", bg: "#fee4e2" };
}

export default function MasterReviewsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await reviewsApi.my();
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

  const avg = rows.length
    ? (rows.reduce((sum, row) => sum + (row.rating || 0), 0) / rows.length).toFixed(1)
    : null;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">Отзывы о мастере</Typography>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">
            Всего отзывов: {rows.length}
          </Typography>
          {avg ? (
            <Chip
              size="small"
              icon={<StarRoundedIcon fontSize="small" />}
              label={`Средняя оценка: ${avg}`}
              color="primary"
              variant="outlined"
            />
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!rows.length && !loading ? (
        <EmptyState
          title="Отзывов пока нет"
          description="После завершения заявок клиенты смогут оценить вашу работу."
        />
      ) : (
        <Stack spacing={1.1}>
          {rows.map((row) => {
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
