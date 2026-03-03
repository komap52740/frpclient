import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
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
  AWAITING_PAYMENT: 120,
  PAYMENT_PROOF_UPLOADED: 110,
  IN_PROGRESS: 100,
  IN_REVIEW: 90,
  NEW: 80,
  PAID: 70,
  COMPLETED: 30,
  DECLINED_BY_MASTER: 20,
  CANCELLED: 10,
};

const DETAIL_FOCUS_BY_ACTION = {
  open_payment: "payment",
  open_chat: "chat",
  open_timeline: "timeline",
  leave_review: "review",
};

function matchesFilter(item, filter) {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") {
    return ["NEW", "IN_REVIEW", "AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED", "PAID", "IN_PROGRESS"].includes(item.status);
  }
  return item.status === filter;
}

function countForFilter(items, filter) {
  return items.filter((item) => matchesFilter(item, filter)).length;
}

function sortItems(items, sortValue) {
  if (sortValue === "created_desc") {
    return [...items].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  }
  if (sortValue === "priority") {
    return [...items].sort((a, b) => {
      const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
      if (unreadDiff !== 0) return unreadDiff;
      const priorityDiff = (PRIORITY_WEIGHT[b.status] || 0) - (PRIORITY_WEIGHT[a.status] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
    });
  }
  return [...items].sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf());
}

function resolveAttentionAction(item) {
  if (!item) return null;

  if (item.status === "AWAITING_PAYMENT") {
    return {
      actionKey: "open_payment",
      title: `Заявка #${item.id}: нужна оплата`,
      helper: "Оплатите и загрузите чек, чтобы мастер сразу продолжил работу.",
      cta: "Перейти к оплате",
    };
  }
  if (item.status === "PAYMENT_PROOF_UPLOADED") {
    return {
      actionKey: "open_chat",
      title: `Заявка #${item.id}: чек на проверке`,
      helper: "Проверка обычно занимает 1-5 минут. При вопросах откройте чат.",
      cta: "Открыть чат",
    };
  }
  if ((item.unread_count || 0) > 0) {
    return {
      actionKey: "open_chat",
      title: `Заявка #${item.id}: есть новые сообщения`,
      helper: "Быстрый ответ в чате заметно ускоряет выполнение заявки.",
      cta: "Перейти к диалогу",
    };
  }
  if (["NEW", "IN_REVIEW", "IN_PROGRESS", "PAID"].includes(item.status)) {
    return {
      actionKey: "open_timeline",
      title: `Заявка #${item.id}: работа в процессе`,
      helper: "Проверьте текущий шаг и последние события по заявке.",
      cta: "Открыть статус",
    };
  }
  return null;
}

export default function MyAppointmentsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sortValue, setSortValue] = useState("updated_desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    setLoading(true);
    try {
      const response = await appointmentsApi.my();
      setItems(response.data || []);
      setError("");
    } catch {
      if (!silent) setError("Не удалось загрузить список заявок");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(
    async () => {
      try {
        const response = await appointmentsApi.my();
        setItems(response.data || []);
      } catch {
        // silent background refresh
      }
    },
    { intervalMs: 5000 }
  );

  const unreadTotal = useMemo(() => items.reduce((sum, item) => sum + (item.unread_count || 0), 0), [items]);
  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((filter) => [filter.key, countForFilter(items, filter.key)])),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    const result = items.filter((item) => {
      if (!matchesFilter(item, activeFilter)) return false;
      if (onlyUnread && (item.unread_count || 0) === 0) return false;
      if (!normalizedQuery) return true;

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

    return sortItems(result, sortValue);
  }, [activeFilter, items, onlyUnread, search, sortValue]);

  const priorityItem = useMemo(() => sortItems(items, "priority")[0] || null, [items]);
  const attentionAction = useMemo(() => resolveAttentionAction(priorityItem), [priorityItem]);

  const handleWorkflowAction = (actionKey, item) => {
    if (actionKey === "create_new") {
      navigate("/client/create");
      return;
    }

    const focus = DETAIL_FOCUS_BY_ACTION[actionKey];
    const suffix = focus ? `?focus=${focus}` : "";
    navigate(`/appointments/${item.id}${suffix}`);
  };

  return (
    <Stack spacing={1.8}>
      <Paper
        sx={{
          p: { xs: 1.5, md: 2.2 },
          borderRadius: 1.8,
          border: "1px solid",
          borderColor: "divider",
          background: (themeValue) =>
            themeValue.palette.mode === "dark"
              ? "linear-gradient(145deg, rgba(11,19,32,0.94) 0%, rgba(17,30,49,0.9) 100%)"
              : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.9) 100%)",
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
            <Box>
              <Typography variant="h2">Мои заявки</Typography>
              <Typography variant="body2" color="text.secondary">
                Один экран для статуса, оплаты и чата без лишнего шума.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {!isMobile ? (
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => load()}
                  disabled={loading}
                  sx={{ minWidth: { xs: "100%", sm: 140 } }}
                >
                  Обновить
                </Button>
              ) : null}
              <Button
                variant="contained"
                onClick={() => navigate("/client/create")}
                sx={{ minWidth: { xs: "100%", sm: 180 } }}
              >
                Новая заявка
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`Всего: ${items.length}`} />
            <Chip
              size="small"
              label={`Непрочитанные: ${unreadTotal}`}
              color={unreadTotal ? "primary" : "default"}
              variant={unreadTotal ? "filled" : "outlined"}
            />
          </Stack>

          {attentionAction ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.1,
                borderRadius: 1.4,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? alpha(themeValue.palette.primary.main, 0.12)
                    : alpha(themeValue.palette.primary.main, 0.08),
              }}
            >
              <Stack spacing={0.7}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Приоритетное действие
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {attentionAction.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {attentionAction.helper}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ alignSelf: "flex-start" }}
                  onClick={() => handleWorkflowAction(attentionAction.actionKey, priorityItem)}
                >
                  {attentionAction.cta}
                </Button>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.3, md: 1.5 }, borderRadius: 1.8 }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Фильтры и поиск
            </Typography>
            <Button
              size="small"
              variant={showAdvancedFilters ? "outlined" : "text"}
              startIcon={<TuneRoundedIcon fontSize="small" />}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
            >
              {showAdvancedFilters ? "Скрыть" : "Показать"}
            </Button>
          </Stack>

          <Tabs value={activeFilter} onChange={(_, value) => setActiveFilter(value)} variant="scrollable" allowScrollButtonsMobile>
            {FILTERS.map((filter) => (
              <Tab key={filter.key} value={filter.key} label={`${filter.label} (${filterCounts[filter.key] || 0})`} />
            ))}
          </Tabs>

          {showAdvancedFilters ? (
            <>
              <TextField
                fullWidth
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                label="Поиск"
                placeholder="Номер, модель, комментарий"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
                <FormControlLabel
                  control={<Switch checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />}
                  label="Только с непрочитанными"
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
            </>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading && !items.length ? (
        <Stack spacing={1}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : filteredItems.length ? (
        <Stack spacing={1}>
          {filteredItems.map((item) => (
            <AppointmentCard
              key={item.id}
              item={item}
              role="client"
              linkTo={`/appointments/${item.id}`}
              showWorkflowAction={!isMobile}
              onPrimaryAction={handleWorkflowAction}
            />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="По этим фильтрам ничего не найдено"
          description="Сбросьте фильтры или создайте новую заявку."
          actionLabel="Создать заявку"
          onAction={() => navigate("/client/create")}
        />
      )}
    </Stack>
  );
}
