import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Button,
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
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { adminApi } from "../../api/client";
import StatusChip from "../../components/StatusChip";
import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../constants/labels";

export default function AdminAppointmentsPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: "", master: "", client: "", date_from: "", date_to: "" });
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const response = await adminApi.appointments(params);
      setRows(response.data);
      setError("");
    } catch {
      setError("Не удалось загрузить список заявок");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Админ: заявки</Typography>

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
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.client}</TableCell>
                <TableCell>{row.assigned_master || "-"}</TableCell>
                <TableCell><StatusChip status={row.status} /></TableCell>
                <TableCell>{row.total_price || "-"}</TableCell>
                <TableCell>
                  <Button component={RouterLink} to={`/appointments/${row.id}`} size="small">
                    Открыть
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
