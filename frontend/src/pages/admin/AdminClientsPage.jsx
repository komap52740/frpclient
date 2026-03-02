import {
  Alert,
  Button,
  Chip,
  Link,
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

const WHOLESALE_LABELS = {
  none: "Не запрошено",
  pending: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
};

function WholesaleStatusChip({ status, discountPercent = 0 }) {
  if (status === "approved") {
    return <Chip size="small" color="success" label={`Одобрено (${discountPercent || 0}%)`} />;
  }
  if (status === "pending") {
    return <Chip size="small" color="warning" variant="outlined" label="На рассмотрении" />;
  }
  if (status === "rejected") {
    return <Chip size="small" color="error" variant="outlined" label="Отклонено" />;
  }
  return <Chip size="small" variant="outlined" label="Не запрошено" />;
}

export default function AdminClientsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [reviewDraftById, setReviewDraftById] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminApi.clients();
      setRows(response.data || []);
      setError("");
      setReviewDraftById((prev) => {
        const next = { ...prev };
        (response.data || []).forEach((row) => {
          if (!next[row.id]) {
            next[row.id] = {
              discount_percent: row.wholesale_discount_percent || 10,
              review_comment: row.wholesale_review_comment || "",
            };
          }
        });
        return next;
      });
    } catch {
      setError("Не удалось загрузить клиентов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ban = async (id) => {
    setSavingId(id);
    try {
      await adminApi.ban(id, reasonById[id] || "");
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const unban = async (id) => {
    setSavingId(id);
    try {
      await adminApi.unban(id);
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const reviewWholesale = async (id, decision) => {
    const draft = reviewDraftById[id] || {};
    const payload = {
      decision,
      review_comment: (draft.review_comment || "").trim(),
    };
    if (decision === "approve") {
      payload.discount_percent = Number(draft.discount_percent || 0);
    }

    setSavingId(id);
    try {
      await adminApi.reviewWholesale(id, payload);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось обработать оптовую заявку");
    } finally {
      setSavingId(0);
    }
  };

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.wholesale_status === statusFilter);
  }, [rows, statusFilter]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography variant="h5">Админ: клиенты, бан и оптовая скидка</Typography>
        <TextField
          select
          size="small"
          label="Опт-статус"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="pending">На рассмотрении</MenuItem>
          <MenuItem value="approved">Одобрено</MenuItem>
          <MenuItem value="rejected">Отклонено</MenuItem>
          <MenuItem value="none">Не запрошено</MenuItem>
        </TextField>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Загрузка...</Alert> : null}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Блокировка</TableCell>
              <TableCell>Причина бана</TableCell>
              <TableCell>Опт-статус</TableCell>
              <TableCell>Сервис</TableCell>
              <TableCell>Данные сервиса</TableCell>
              <TableCell>Фото</TableCell>
              <TableCell>Комментарий</TableCell>
              <TableCell>Скидка, %</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((row) => {
              const isSaving = savingId === row.id;
              const draft = reviewDraftById[row.id] || { discount_percent: 10, review_comment: "" };

              return (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>{row.is_banned ? "Забанен" : "Активен"}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={reasonById[row.id] || row.ban_reason || ""}
                      onChange={(e) => setReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Причина"
                    />
                  </TableCell>
                  <TableCell>
                    <WholesaleStatusChip
                      status={row.wholesale_status}
                      discountPercent={row.wholesale_discount_percent}
                    />
                  </TableCell>
                  <TableCell>{row.wholesale_company_name || "—"}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>
                    {row.wholesale_service_details ? (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {row.wholesale_service_details}
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 170 }}>
                    <Stack spacing={0.4}>
                      {row.wholesale_service_photo_1_url ? (
                        <Link href={row.wholesale_service_photo_1_url} target="_blank" rel="noreferrer">
                          Фото сервиса 1
                        </Link>
                      ) : null}
                      {row.wholesale_service_photo_2_url ? (
                        <Link href={row.wholesale_service_photo_2_url} target="_blank" rel="noreferrer">
                          Фото сервиса 2
                        </Link>
                      ) : null}
                      {!row.wholesale_service_photo_1_url && !row.wholesale_service_photo_2_url ? "—" : null}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={draft.review_comment}
                      onChange={(e) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, review_comment: e.target.value },
                        }))
                      }
                      placeholder="Комментарий админа"
                    />
                  </TableCell>
                  <TableCell sx={{ width: 110 }}>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, max: 90 }}
                      value={draft.discount_percent}
                      onChange={(e) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, discount_percent: e.target.value },
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                      {row.is_banned ? (
                        <Button size="small" color="success" disabled={isSaving} onClick={() => unban(row.id)}>
                          Разбанить
                        </Button>
                      ) : (
                        <Button size="small" color="error" disabled={isSaving} onClick={() => ban(row.id)}>
                          Забанить
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        disabled={isSaving}
                        onClick={() => reviewWholesale(row.id, "approve")}
                      >
                        Одобрить опт
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={isSaving}
                        onClick={() => reviewWholesale(row.id, "reject")}
                      >
                        Отклонить
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        Опт-статусы: {WHOLESALE_LABELS.none}, {WHOLESALE_LABELS.pending}, {WHOLESALE_LABELS.approved}, {WHOLESALE_LABELS.rejected}.
      </Typography>
    </Stack>
  );
}
