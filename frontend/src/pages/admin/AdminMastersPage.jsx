import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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

function qualityChip(row) {
  if (row.master_quality_approved) {
    return <Chip size="small" color="success" label="Допущен" />;
  }
  return <Chip size="small" color="warning" variant="outlined" label="Без допуска" />;
}

export default function AdminMastersPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [qualityFilter, setQualityFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [drafts, setDrafts] = useState({});

  const requestParams = useMemo(() => {
    const params = {};
    if (qualityFilter !== "all") {
      params.quality = qualityFilter;
    }
    if (levelFilter !== "all") {
      params.level = levelFilter;
    }
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
      setSavingId(null);
    }
  };

  const suspend = async (id) => {
    try {
      setSavingId(id);
      await adminApi.suspendMaster(id);
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const onDraftChange = (id, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
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
      setSavingId(null);
    }
  };

  const toggleQualityApproval = async (row) => {
    try {
      setSavingId(row.id);
      await adminApi.updateMasterQuality(row.id, {
        master_quality_approved: !row.master_quality_approved,
      });
      await load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Админ: качество мастеров</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper sx={{ p: 1.5 }}>
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

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Скор</TableCell>
              <TableCell>Активность</TableCell>
              <TableCell>Допуск</TableCell>
              <TableCell>Уровень</TableCell>
              <TableCell>Специализация</TableCell>
              <TableCell>Комментарий QA</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const draft = drafts[row.id] || {};
              const busy = savingId === row.id;
              return (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>{row.master_stats?.master_score ?? "—"}</TableCell>
                  <TableCell>{row.is_master_active ? "Активен" : "Отключен"}</TableCell>
                  <TableCell>{qualityChip(row)}</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={draft.master_level || "junior"}
                      onChange={(event) => onDraftChange(row.id, "master_level", event.target.value)}
                    >
                      {LEVEL_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={draft.master_specializations || ""}
                      onChange={(event) => onDraftChange(row.id, "master_specializations", event.target.value)}
                      placeholder="Samsung FRP, Xiaomi, iPhone"
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={draft.master_quality_comment || ""}
                      onChange={(event) => onDraftChange(row.id, "master_quality_comment", event.target.value)}
                      placeholder="Качество, дисциплина, SLA"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {row.is_master_active ? (
                        <Button size="small" color="warning" disabled={busy} onClick={() => suspend(row.id)}>
                          Отключить
                        </Button>
                      ) : (
                        <Button size="small" color="success" disabled={busy} onClick={() => activate(row.id)}>
                          Активировать
                        </Button>
                      )}
                      <Button size="small" variant="outlined" disabled={busy} onClick={() => saveQuality(row.id)}>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
