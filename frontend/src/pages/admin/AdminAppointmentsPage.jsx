import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { adminApi, authApi } from "../../api/client";
import KpiCard from "../../components/KpiCard";
import StatusChip from "../../components/StatusChip";
import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../constants/labels";
import useAutoRefresh from "../../hooks/useAutoRefresh";

const URGENT_STATUSES = new Set(["PAYMENT_PROOF_UPLOADED", "AWAITING_PAYMENT", "IN_PROGRESS"]);

function isUrgent(row) {
  if (!row) return false;
  if (row.sla_breached) return true;
  if ((row.unread_count || 0) > 0) return true;
  return URGENT_STATUSES.has(row.status);
}

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const urgentDiff = Number(isUrgent(b)) - Number(isUrgent(a));
    if (urgentDiff !== 0) return urgentDiff;
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) return unreadDiff;
    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });
}

export default function AdminAppointmentsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ status: "", master: "", client: "", date_from: "", date_to: "" });
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("urgent");

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const [appointmentsResponse, summaryData] = await Promise.all([
        adminApi.appointments(params),
        authApi.dashboardSummary(),
      ]);
      setRows(sortRows(appointmentsResponse.data || []));
      setSummary(summaryData.counts || {});
      setError("");
    } catch {
      if (!silent) {
        setError("Не удалось загрузить список заявок");
      }
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true }), { intervalMs: 7000 });

  const urgentRows = useMemo(() => rows.filter(isUrgent), [rows]);
  const visibleRows = useMemo(() => (viewMode === "urgent" ? urgentRows : rows), [rows, urgentRows, viewMode]);
  const focusRow = visibleRows[0] || rows[0] || null;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Админ: заявки</Typography>

      <Paper sx={{ p: 1.4, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Tabs
              value={viewMode}
              onChange={(_, value) => setViewMode(value)}
              sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, textTransform: "none", fontWeight: 700 } }}
            >
              <Tab value="urgent" label={`Срочные (${urgentRows.length})`} />
              <Tab value="all" label={`Все (${rows.length})`} />
            </Tabs>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                color={urgentRows.length ? "error" : "default"}
                variant={urgentRows.length ? "filled" : "outlined"}
                label={`SLA/оплата: ${urgentRows.length}`}
              />
              {focusRow ? (
                <Button variant="contained" size="small" onClick={() => navigate(`/appointments/${focusRow.id}`)}>
                  Открыть первую
                </Button>
              ) : null}
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Срочные: заявки с риском SLA, с непрочитанными сообщениями и с ожиданием оплаты/проверки чека.
          </Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Всего заявок" value={summary?.appointments_total ?? "-"} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Новые" value={summary?.appointments_new ?? "-"} accent="#15616d" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Активные" value={summary?.appointments_active ?? "-"} accent="#2e8a66" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Ждут подтверждение" value={summary?.payments_waiting_confirmation ?? "-"} accent="#bf4342" />
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1} direction={{ xs: "column", md: "row" }}>
          <TextField
            select
            label="Статус"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Все</MenuItem>
            {APPOINTMENT_STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>
            ))}
          </TextField>
          <TextField label="ID мастера" value={filters.master} onChange={(e) => setFilters((prev) => ({ ...prev, master: e.target.value }))} />
          <TextField label="ID клиента" value={filters.client} onChange={(e) => setFilters((prev) => ({ ...prev, client: e.target.value }))} />
          <TextField type="date" label="С" InputLabelProps={{ shrink: true }} value={filters.date_from} onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))} />
          <TextField type="date" label="По" InputLabelProps={{ shrink: true }} value={filters.date_to} onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))} />
          <Button variant="contained" onClick={load} startIcon={<SearchIcon />}>
            Фильтр
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Клиент</TableCell>
              <TableCell>Мастер</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Цена</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  sx={
                    isUrgent(row)
                      ? {
                          bgcolor: "rgba(239,68,68,0.04)",
                          "& td": { borderBottomColor: "rgba(239,68,68,0.26)" },
                        }
                      : undefined
                  }
                >
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.client_username || row.client}</TableCell>
                  <TableCell>{row.master_username || row.assigned_master || "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                      <StatusChip status={row.status} />
                      {(row.unread_count || 0) > 0 ? (
                        <Chip size="small" color="primary" variant="outlined" label={`Сообщения: ${row.unread_count}`} />
                      ) : null}
                      {row.sla_breached ? (
                        <Chip size="small" color="error" variant="filled" label="SLA риск" />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{row.total_price ? `${row.total_price} ₽` : "-"}</TableCell>
                  <TableCell>
                    <Button component={RouterLink} to={`/appointments/${row.id}`} size="small">
                      Открыть
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    {viewMode === "urgent"
                      ? "Срочных заявок сейчас нет."
                      : "Заявки по выбранному фильтру не найдены."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
