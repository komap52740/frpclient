import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  Divider,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

function WholesaleStatusChip({ status }) {
  if (status === "approved") return <Chip size="small" color="success" label="Опт: одобрено" />;
  if (status === "pending") return <Chip size="small" color="warning" variant="outlined" label="Опт: на рассмотрении" />;
  if (status === "rejected") return <Chip size="small" color="error" variant="outlined" label="Опт: отклонено" />;
  return <Chip size="small" variant="outlined" label="Опт: не запрошено" />;
}

export default function AdminClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [reviewDraftById, setReviewDraftById] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const response = await adminApi.clients();
      const items = response.data || [];
      setRows(items);
      setError("");
      setReviewDraftById((prev) => {
        const next = { ...prev };
        items.forEach((row) => {
          if (!next[row.id]) {
            next[row.id] = { review_comment: row.wholesale_review_comment || "" };
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
    if (!canManage) return;
    setSavingId(id);
    try {
      await adminApi.ban(id, reasonById[id] || "");
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const unban = async (id) => {
    if (!canManage) return;
    setSavingId(id);
    try {
      await adminApi.unban(id);
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const reviewWholesale = async (id, decision) => {
    if (!canManage) return;
    const draft = reviewDraftById[id] || {};
    const payload = {
      decision,
      review_comment: (draft.review_comment || "").trim(),
    };

    setSavingId(id);
    try {
      await adminApi.reviewWholesale(id, payload);
      await load();
    } catch (e) {
      const data = e?.response?.data;
      const detail =
        data?.detail ||
        (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : null) ||
        (Array.isArray(data?.discount_percent) ? data.discount_percent[0] : null);
      setError(detail || "Не удалось обработать оптовую заявку");
    } finally {
      setSavingId(0);
    }
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.wholesale_status !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        row.username,
        row.wholesale_company_name,
        row.wholesale_city,
        row.wholesale_address,
        row.wholesale_comment,
        row.wholesale_service_details,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((row) => row.wholesale_status === "pending").length;
    const approved = rows.filter((row) => row.wholesale_status === "approved").length;
    const banned = rows.filter((row) => row.is_banned).length;
    return { total, pending, approved, banned };
  }, [rows]);

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="h5">{canManage ? "Клиенты и оптовый статус" : "Клиенты"}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label={`Всего: ${stats.total}`} />
          <Chip
            size="small"
            color={stats.pending ? "warning" : "default"}
            variant={stats.pending ? "filled" : "outlined"}
            label={`На рассмотрении: ${stats.pending}`}
          />
          <Chip
            size="small"
            color={stats.approved ? "success" : "default"}
            variant={stats.approved ? "filled" : "outlined"}
            label={`Одобрено: ${stats.approved}`}
          />
          <Chip
            size="small"
            color={stats.banned ? "error" : "default"}
            variant={stats.banned ? "filled" : "outlined"}
            label={`Заблокированы: ${stats.banned}`}
          />
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.5, borderRadius: 1.8 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Поиск клиента или сервиса"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            sx={{ flex: 1, minWidth: { xs: "100%", md: 320 } }}
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
            size="small"
            label="Опт-статус"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 220 } }}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="pending">На рассмотрении</MenuItem>
            <MenuItem value="approved">Одобрено</MenuItem>
            <MenuItem value="rejected">Отклонено</MenuItem>
            <MenuItem value="none">Не запрошено</MenuItem>
          </TextField>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          >
            Сбросить
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Загрузка...</Alert> : null}
      {!loading && filteredRows.length === 0 ? (
        <Alert severity="info">По фильтрам ничего не найдено. Попробуйте снять ограничения.</Alert>
      ) : null}

      <Stack spacing={1}>
        {filteredRows.map((row) => {
          const isSaving = savingId === row.id;
          const draft = reviewDraftById[row.id] || { review_comment: "" };
          const company = (row.wholesale_company_name || "").trim();
          const city = (row.wholesale_city || "").trim();
          const address = (row.wholesale_address || "").trim();

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
                      <WholesaleStatusChip status={row.wholesale_status} />
                      {row.is_banned ? <Chip size="small" color="error" variant="outlined" label="Заблокирован" /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 560 }} noWrap>
                      {company || "Без названия сервиса"}
                      {city || address ? ` • ${[city, address].filter(Boolean).join(", ")}` : ""}
                    </Typography>
                  </Stack>
                  <Button size="small" variant="outlined" onClick={() => navigate(`/clients/${row.id}/profile`)}>
                    Профиль
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.2}>
                  {row.wholesale_service_details ? (
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                      <Typography variant="caption" color="text.secondary">
                        Описание сервиса
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {row.wholesale_service_details}
                      </Typography>
                    </Paper>
                  ) : null}

                  {row.wholesale_service_photo_1_url || row.wholesale_service_photo_2_url ? (
                    <Stack direction="row" spacing={1}>
                      {row.wholesale_service_photo_1_url ? (
                        <Link href={row.wholesale_service_photo_1_url} target="_blank" rel="noreferrer">
                          Фото 1
                        </Link>
                      ) : null}
                      {row.wholesale_service_photo_2_url ? (
                        <Link href={row.wholesale_service_photo_2_url} target="_blank" rel="noreferrer">
                          Фото 2
                        </Link>
                      ) : null}
                    </Stack>
                  ) : null}

                  {canManage ? <Divider /> : null}

                  {canManage ? (
                    <TextField
                      size="small"
                      label="Причина бана"
                      value={reasonById[row.id] || row.ban_reason || ""}
                      onChange={(event) => setReasonById((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    />
                  ) : null}

                  {canManage ? (
                    <TextField
                      size="small"
                      label="Комментарий администратора"
                      value={draft.review_comment}
                      onChange={(event) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, review_comment: event.target.value },
                        }))
                      }
                      fullWidth
                    />
                  ) : null}

                  {canManage ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {row.is_banned ? (
                        <Button size="small" color="success" variant="outlined" disabled={isSaving} onClick={() => unban(row.id)}>
                          Разбанить
                        </Button>
                      ) : (
                        <Button size="small" color="error" variant="outlined" disabled={isSaving} onClick={() => ban(row.id)}>
                          Забанить
                        </Button>
                      )}
                      <Button size="small" variant="contained" disabled={isSaving} onClick={() => reviewWholesale(row.id, "approve")}>
                        Одобрить опт
                      </Button>
                      <Button size="small" variant="outlined" color="warning" disabled={isSaving} onClick={() => reviewWholesale(row.id, "reject")}>
                        Отклонить
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Stack>
  );
}
