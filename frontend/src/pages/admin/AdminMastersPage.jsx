import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
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
  { value: "junior", label: "Junior" },
  { value: "middle", label: "Middle" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
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

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Качество мастеров</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper sx={{ p: 1.5, borderRadius: 1.8 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
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
        </Stack>
      </Paper>

      <Stack spacing={1}>
        {rows.map((row) => {
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{row.username}</Typography>
                    {qualityChip(row.master_quality_approved)}
                    <Chip size="small" variant="outlined" label={`Score: ${row.master_stats?.master_score ?? "—"}`} />
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
                      sx={{ minWidth: 200 }}
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
