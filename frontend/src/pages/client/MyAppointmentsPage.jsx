import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";
import EmptyState from "../../components/EmptyState";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import { getStatusLabel } from "../../constants/labels";
import useAutoRefresh from "../../hooks/useAutoRefresh";

const FILTERS = [
  { key: "ALL", label: "Все" },
  { key: "ACTIVE", label: "Активные" },
  { key: "AWAITING_PAYMENT", label: "Нужна оплата" },
  { key: "IN_PROGRESS", label: "В работе" },
  { key: "COMPLETED", label: "Завершенные" },
];

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Сначала последние" },
  { value: "priority", label: "Сначала важные" },
  { value: "created_desc", label: "Сначала новые" },
];

const PRIORITY_WEIGHT = {
  AWAITING_PAYMENT: 100,
  PAYMENT_PROOF_UPLOADED: 90,
  IN_PROGRESS: 80,
  IN_REVIEW: 70,
  NEW: 60,
  PAID: 50,
  COMPLETED: 20,
  DECLINED_BY_MASTER: 10,
  CANCELLED: 5,
};

function matchesFilter(item, filter) {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "ACTIVE") {
    return ["NEW", "IN_REVIEW", "AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED", "PAID", "IN_PROGRESS"].includes(item.status);
  }
  return item.status === filter;
}

function sortItems(items, sortValue) {
  if (sortValue === "created_desc") {
    return [...items].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  }

  if (sortValue === "priority") {
    return [...items].sort((a, b) => {
      const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
      if (unreadDiff !== 0) {
        return unreadDiff;
      }

      const priorityDiff = (PRIORITY_WEIGHT[b.status] || 0) - (PRIORITY_WEIGHT[a.status] || 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
    });
  }

  return [...items].sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf());
}

export default function MyAppointmentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sortValue, setSortValue] = useState("updated_desc");

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

  const filteredItems = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    const base = items.filter((item) => {
      if (!matchesFilter(item, activeFilter)) {
        return false;
      }
      if (onlyUnread && (item.unread_count || 0) === 0) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        String(item.id || ""),
        item.brand || "",
        item.model || "",
        item.description || "",
        getStatusLabel(item.status),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return sortItems(base, sortValue);
  }, [activeFilter, items, onlyUnread, search, sortValue]);

  const repeatAppointment = async (appointmentId) => {
    try {
      const response = await appointmentsApi.repeat(appointmentId);
      navigate(`/appointments/${response.data.id}`);
    } catch {
      setError("Не удалось создать повторную заявку");
    }
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Typography variant="h5">Мои заявки</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Обновить
        </Button>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.2}>
          <Typography variant="body2" color="text.secondary">
            Всего заявок: {items.length} | Непрочитанных сообщений: {unreadTotal}
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              label="Поиск по заявкам"
              placeholder="Номер, модель, описание"
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
              label="Сортировка"
              value={sortValue}
              onChange={(event) => setSortValue(event.target.value)}
              sx={{ minWidth: { xs: "100%", md: 240 } }}
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            {FILTERS.map((filter) => (
              <Chip
                key={filter.key}
                label={filter.label}
                color={activeFilter === filter.key ? "primary" : "default"}
                variant={activeFilter === filter.key ? "filled" : "outlined"}
                onClick={() => setActiveFilter(filter.key)}
              />
            ))}
          </Stack>

          <Box>
            <FormControlLabel
              control={<Switch checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />}
              label="Только с непрочитанными сообщениями"
            />
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !items.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : filteredItems.length ? (
        <Stack spacing={1.25}>
          {filteredItems.map((item) => (
            <Stack key={item.id} spacing={0.7}>
              <AppointmentCard item={item} role="client" linkTo={`/appointments/${item.id}`} />
              {["COMPLETED", "DECLINED_BY_MASTER", "CANCELLED"].includes(item.status) ? (
                <Button
                  variant="text"
                  startIcon={<ReplayRoundedIcon fontSize="small" />}
                  onClick={() => repeatAppointment(item.id)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Создать похожую заявку
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="По заданным фильтрам ничего не найдено"
          description="Попробуйте сбросить фильтры или создать новую заявку."
          actionLabel="Создать заявку"
          onAction={() => navigate("/client/create")}
        />
      )}
    </Stack>
  );
}
