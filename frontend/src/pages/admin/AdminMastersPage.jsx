import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";

const LEVEL_OPTIONS = [
  { value: "trainee", label: "Стажер" },
  { value: "junior", label: "Обычный мастер" },
  { value: "middle", label: "Опытный мастер" },
  { value: "senior", label: "Старший мастер" },
  { value: "lead", label: "Тимлид" },
];

function qualityChip(approved) {
  if (approved) return <Chip size="small" color="success" label="Допущен" />;
  return <Chip size="small" color="warning" variant="outlined" label="Без допуска" />;
}

export default function AdminMastersPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(0);
  const [qualityFilter, setQualityFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [drafts, setDrafts] = useState({});

  const requestParams = useMemo(() => {
    const params = {};
    if (qualityFilter !== "all") params.quality = qualityFilter;
    if (levelFilter !== "all") params.level = levelFilter;
    return params;
  }, [levelFilter, qualityFilter]);

  const syncDrafts = (items) => {
    const next = {};
    items.forEach((row) => {
      next[row.id] = {
        master_level: row.master_level || "junior",
        master_specializations: row.master_specializations || "",
        master_quality_comment: row.master_quality_comment || "",
      };
    });
    setDrafts(next);
  };

  const load = async () => {
    try {
      const response = await adminApi.masters(requestParams);
      const list = response.data || [];
      setRows(list);
      syncDrafts(list);
      setError("");
    } catch {
      setError("Не удалось загрузить мастеров");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestParams]);

  const activate = async (id) => {
    try {
      setSavingId(id);
      await adminApi.activateMaster(id);
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const suspend = async (id) => {
    try {
      setSavingId(id);
      await adminApi.suspendMaster(id);
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const onDraftChange = (id, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  };

  const saveQuality = async (id) => {
    const draft = drafts[id] || {};
    try {
      setSavingId(id);
      await adminApi.updateMasterQuality(id, {
        master_level: draft.master_level || "junior",
        master_specializations: (draft.master_specializations || "").trim(),
        master_quality_comment: (draft.master_quality_comment || "").trim(),
      });
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const toggleQualityApproval = async (row) => {
    try {
      setSavingId(row.id);
      await adminApi.updateMasterQuality(row.id, { master_quality_approved: !row.master_quality_approved });
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [row.username, row.master_specializations, row.master_quality_comment]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.is_master_active).length;
    const approved = rows.filter((row) => row.master_quality_approved).length;
    const pending = total - approved;
    return { total, active, approved, pending };
  }, [rows]);

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="h5">Качество мастеров</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label={`Всего: ${stats.total}`} />
          <Chip
            size="small"
            color={stats.active ? "success" : "default"}
            variant={stats.active ? "filled" : "outlined"}
            label={`Активны: ${stats.active}`}
          />
          <Chip
            size="small"
            color={stats.approved ? "success" : "default"}
            variant={stats.approved ? "filled" : "outlined"}
            label={`С допуском: ${stats.approved}`}
          />
          <Chip
            size="small"
            color={stats.pending ? "warning" : "default"}
            variant={stats.pending ? "filled" : "outlined"}
            label={`Без допуска: ${stats.pending}`}
          />
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper sx={{ p: 1.5, borderRadius: 1.8 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Поиск мастера"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            sx={{ flex: 1, minWidth: { xs: "100%", md: 300 } }}
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
            label="Фильтр допуска"
            value={qualityFilter}
            onChange={(event) => setQualityFilter(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 220 } }}
            size="small"
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="approved">Допущены</MenuItem>
            <MenuItem value="pending">Без допуска</MenuItem>
          </TextField>
          <TextField
            select
            label="Фильтр уровня"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 220 } }}
            size="small"
          >
            <MenuItem value="all">Любой уровень</MenuItem>
            {LEVEL_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSearchQuery("");
              setQualityFilter("all");
              setLevelFilter("all");
            }}
          >
            Сбросить
          </Button>
        </Stack>
      </Paper>

      {!filteredRows.length ? <Alert severity="info">Мастера по текущим фильтрам не найдены.</Alert> : null}

      <Stack spacing={1}>
        {filteredRows.map((row) => {
          const draft = drafts[row.id] || {};
          const busy = savingId === row.id;

          return (
            <Accordion key={row.id} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ width: "100%", pr: 1 }}
                >
                  <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {row.username}
                      </Typography>
                      {qualityChip(row.master_quality_approved)}
                      <Chip size="small" variant="outlined" label={`Score: ${row.master_stats?.master_score ?? "—"}`} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 560 }}>
                      {row.master_specializations || "Специализация не указана"}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    color={row.is_master_active ? "success" : "default"}
                    variant={row.is_master_active ? "filled" : "outlined"}
                    label={row.is_master_active ? "Активен" : "Отключен"}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.1}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Уровень"
                      value={draft.master_level || "junior"}
                      onChange={(event) => onDraftChange(row.id, "master_level", event.target.value)}
                      sx={{ minWidth: 230 }}
                    >
                      {LEVEL_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small"
                      label="Специализация"
                      value={draft.master_specializations || ""}
                      onChange={(event) => onDraftChange(row.id, "master_specializations", event.target.value)}
                      sx={{ flexGrow: 1 }}
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="Комментарий QA"
                    value={draft.master_quality_comment || ""}
                    onChange={(event) => onDraftChange(row.id, "master_quality_comment", event.target.value)}
                    fullWidth
                  />

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {row.is_master_active ? (
                      <Button size="small" color="warning" variant="outlined" disabled={busy} onClick={() => suspend(row.id)}>
                        Отключить
                      </Button>
                    ) : (
                      <Button size="small" color="success" variant="outlined" disabled={busy} onClick={() => activate(row.id)}>
                        Активировать
                      </Button>
                    )}
                    <Button size="small" variant="contained" disabled={busy} onClick={() => saveQuality(row.id)}>
                      Сохранить
                    </Button>
                    <Button
                      size="small"
                      variant={row.master_quality_approved ? "outlined" : "contained"}
                      color={row.master_quality_approved ? "warning" : "success"}
                      disabled={busy}
                      onClick={() => toggleQualityApproval(row)}
                    >
                      {row.master_quality_approved ? "Снять допуск" : "Допустить"}
                    </Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Stack>
  );
}
