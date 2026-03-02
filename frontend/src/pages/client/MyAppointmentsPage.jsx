import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
  { key: "ALL", label: "Р’СЃРµ" },
  { key: "ACTIVE", label: "РђРєС‚РёРІРЅС‹Рµ" },
  { key: "AWAITING_PAYMENT", label: "РќСѓР¶РЅР° РѕРїР»Р°С‚Р°" },
  { key: "IN_PROGRESS", label: "Р’ СЂР°Р±РѕС‚Рµ" },
  { key: "COMPLETED", label: "Р—Р°РІРµСЂС€РµРЅРЅС‹Рµ" },
];

const SORT_OPTIONS = [
  { value: "updated_desc", label: "РЎРЅР°С‡Р°Р»Р° РїРѕСЃР»РµРґРЅРёРµ" },
  { value: "priority", label: "РЎРЅР°С‡Р°Р»Р° РІР°Р¶РЅС‹Рµ" },
  { value: "created_desc", label: "РЎРЅР°С‡Р°Р»Р° РЅРѕРІС‹Рµ" },
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

const DETAIL_FOCUS_BY_ACTION = {
  open_payment: "payment",
  open_chat: "chat",
  open_timeline: "timeline",
  leave_review: "review",
};

function matchesFilter(item, filter) {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "ACTIVE") {
    return ["NEW", "IN_REVIEW", "AWAITING_PAYMENT", "PAYMENT_PROOF_UPLOADED", "PAID", "IN_PROGRESS"].includes(
      item.status
    );
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

function resolveAttentionAction(item) {
  if (!item) return null;

  if (item.status === "AWAITING_PAYMENT") {
    return {
      actionKey: "open_payment",
      title: `Р—Р°СЏРІРєР° #${item.id}: РЅСѓР¶РЅР° РѕРїР»Р°С‚Р°`,
      helper: "РћРїР»Р°С‚РёС‚Рµ Рё Р·Р°РіСЂСѓР·РёС‚Рµ С‡РµРє, С‡С‚РѕР±С‹ РјР°СЃС‚РµСЂ РїСЂРѕРґРѕР»Р¶РёР» СЂР°Р±РѕС‚Сѓ Р±РµР· РїР°СѓР·С‹.",
      cta: "РџРµСЂРµР№С‚Рё Рє РѕРїР»Р°С‚Рµ",
    };
  }
  if (item.status === "PAYMENT_PROOF_UPLOADED") {
    return {
      actionKey: "open_chat",
      title: `Р—Р°СЏРІРєР° #${item.id}: С‡РµРє РЅР° РїСЂРѕРІРµСЂРєРµ`,
      helper: "РџСЂРѕРІРµСЂРєР° РѕР±С‹С‡РЅРѕ Р·Р°РЅРёРјР°РµС‚ 1-5 РјРёРЅСѓС‚. Р•СЃР»Рё РµСЃС‚СЊ РІРѕРїСЂРѕСЃ, РѕС‚РєСЂРѕР№С‚Рµ С‡Р°С‚.",
      cta: "РћС‚РєСЂС‹С‚СЊ С‡Р°С‚",
    };
  }
  if ((item.unread_count || 0) > 0) {
    return {
      actionKey: "open_chat",
      title: `Р—Р°СЏРІРєР° #${item.id}: РµСЃС‚СЊ РЅРѕРІС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ`,
      helper: "Р‘С‹СЃС‚СЂС‹Р№ РѕС‚РІРµС‚ РІ С‡Р°С‚Рµ СѓСЃРєРѕСЂСЏРµС‚ РІРµСЃСЊ РїСЂРѕС†РµСЃСЃ.",
      cta: "РџРµСЂРµР№С‚Рё Рє РґРёР°Р»РѕРіСѓ",
    };
  }
  if (["NEW", "IN_REVIEW", "IN_PROGRESS", "PAID"].includes(item.status)) {
    return {
      actionKey: "open_timeline",
      title: `Р—Р°СЏРІРєР° #${item.id}: СЂР°Р±РѕС‚Р° РІ РїСЂРѕС†РµСЃСЃРµ`,
      helper: "РџСЂРѕРІРµСЂСЊС‚Рµ С‚РµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ Рё РїРѕСЃР»РµРґРЅРёРµ СЃРѕР±С‹С‚РёСЏ РїРѕ Р·Р°СЏРІРєРµ.",
      cta: "РћС‚РєСЂС‹С‚СЊ СЃС‚Р°С‚СѓСЃ",
    };
  }
  return null;
}

export default function MyAppointmentsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sortValue, setSortValue] = useState("updated_desc");
  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);

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
        setError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє Р·Р°СЏРІРѕРє");
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

  useEffect(() => {
    setFiltersExpanded(!isMobile);
  }, [isMobile]);

  useAutoRefresh(
    async () => {
      setAutoRefreshing(true);
      try {
        await load({ silent: true, withLoading: false });
      } finally {
        setAutoRefreshing(false);
      }
    },
    { intervalMs: 5000 }
  );

  const unreadTotal = useMemo(() => items.reduce((sum, item) => sum + (item.unread_count || 0), 0), [items]);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((filter) => [filter.key, countForFilter(items, filter.key)])
      ),
    [items]
  );

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

  const priorityItem = useMemo(() => sortItems(items, "priority")[0] || null, [items]);
  const attentionAction = useMemo(() => resolveAttentionAction(priorityItem), [priorityItem]);

  const repeatAppointment = async (appointmentId) => {
    try {
      const response = await appointmentsApi.repeat(appointmentId);
      navigate(`/appointments/${response.data.id}`);
    } catch {
      setError("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїРѕРІС‚РѕСЂРЅСѓСЋ Р·Р°СЏРІРєСѓ");
    }
  };

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
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.25, md: 2 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          background: isDark
            ? "linear-gradient(145deg, rgba(15,23,42,0.94) 0%, rgba(18,32,50,0.9) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(239,248,255,0.9) 100%)",
        }}
      >
        <Stack spacing={1.2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h2">РњРѕРё Р·Р°СЏРІРєРё</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                РћРґРёРЅ СЌРєСЂР°РЅ РґР»СЏ СЃС‚Р°С‚СѓСЃР°, РѕРїР»Р°С‚С‹ Рё С‡Р°С‚Р° Р±РµР· Р»РёС€РЅРµРіРѕ С€СѓРјР°.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => load()}
                disabled={loading}
                sx={{ minWidth: { xs: "100%", sm: 124 }, minHeight: { xs: 40, sm: 42 } }}
              >
                РћР±РЅРѕРІРёС‚СЊ
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate("/client/create")}
                sx={{ minWidth: { xs: "100%", sm: 164 }, minHeight: { xs: 40, sm: 42 } }}
              >
                РќРѕРІР°СЏ Р·Р°СЏРІРєР°
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`Р’СЃРµРіРѕ: ${items.length}`} />
            <Chip size="small" color={unreadTotal ? "primary" : "default"} variant={unreadTotal ? "filled" : "outlined"} label={`РќРµРїСЂРѕС‡РёС‚Р°РЅРЅС‹Рµ: ${unreadTotal}`} />
          </Stack>

          {autoRefreshing ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

          {attentionAction ? (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1, md: 1.2 },
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                background: isDark
                  ? "linear-gradient(140deg, rgba(14,28,46,0.9) 0%, rgba(18,34,54,0.86) 100%)"
                  : "linear-gradient(140deg, rgba(238,249,255,0.95) 0%, rgba(255,255,255,0.95) 100%)",
              }}
            >
              <Stack spacing={0.6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Р§С‚Рѕ РІР°Р¶РЅРѕ СЃРµР№С‡Р°СЃ
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {attentionAction.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  {attentionAction.helper}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ alignSelf: "flex-start", minWidth: { xs: "100%", sm: "auto" } }}
                  onClick={() => handleWorkflowAction(attentionAction.actionKey, priorityItem)}
                >
                  {attentionAction.cta}
                </Button>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1, md: 1.5 }, borderRadius: 3 }}>
        <Stack spacing={1.1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Фильтр и сортировка
            </Typography>
            {isMobile ? (
              <Button
                size="small"
                variant={filtersExpanded ? "outlined" : "text"}
                startIcon={<TuneRoundedIcon fontSize="small" />}
                onClick={() => setFiltersExpanded((prev) => !prev)}
                sx={{ minHeight: 30, px: 1 }}
              >
                {filtersExpanded ? "Свернуть" : "Настроить"}
              </Button>
            ) : null}
          </Stack>

          <Tabs
            value={activeFilter}
            onChange={(_, value) => setActiveFilter(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                textTransform: "none",
                fontSize: isMobile ? 12.5 : 13.5,
                fontWeight: 700,
                px: 1.2,
              },
            }}
          >
            {FILTERS.map((filter) => (
              <Tab
                key={filter.key}
                value={filter.key}
                label={`${filter.label} (${filterCounts[filter.key] || 0})`}
              />
            ))}
          </Tabs>

          {filtersExpanded ? (
            <>
              <TextField
                fullWidth
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                label="Поиск по заявкам"
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
                  control={
                    <Switch checked={onlyUnread} onChange={(event) => setOnlyUnread(event.target.checked)} />
                  }
                  label="Только с непрочитанными"
                />

                <TextField
                  select
                  label="Сортировка"
                  value={sortValue}
                  onChange={(event) => setSortValue(event.target.value)}
                  sx={{ minWidth: { xs: "100%", md: 260 } }}
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
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : filteredItems.length ? (
        <Stack spacing={1}>
          {filteredItems.map((item) => (
            <Stack key={item.id} spacing={0.7}>
              <AppointmentCard
                item={item}
                role="client"
                linkTo={`/appointments/${item.id}`}
                showWorkflowAction
                onPrimaryAction={handleWorkflowAction}
              />
              {["COMPLETED", "DECLINED_BY_MASTER", "CANCELLED"].includes(item.status) ? (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ReplayRoundedIcon fontSize="small" />}
                  onClick={() => repeatAppointment(item.id)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  РџРѕРІС‚РѕСЂРёС‚СЊ Р·Р°СЏРІРєСѓ
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="РџРѕ СЌС‚РёРј С„РёР»СЊС‚СЂР°Рј РЅРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ"
          description="РЎР±СЂРѕСЃСЊС‚Рµ С„РёР»СЊС‚СЂС‹ РёР»Рё СЃРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ Р·Р°СЏРІРєСѓ."
          actionLabel="РЎРѕР·РґР°С‚СЊ Р·Р°СЏРІРєСѓ"
          onAction={() => navigate("/client/create")}
        />
      )}
    </Stack>
  );
}

