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
import dayjs from "dayjs";
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

const WHOLESALE_PRIORITY_OPTIONS = [
  { value: "standard", label: "Стандарт" },
  { value: "priority", label: "Приоритет" },
  { value: "critical", label: "Критический" },
];

function WholesalePriorityChip({ value }) {
  const item = WHOLESALE_PRIORITY_OPTIONS.find((option) => option.value === value) || WHOLESALE_PRIORITY_OPTIONS[0];
  if (item.value === "critical") {
    return <Chip size="small" color="error" label={`PRO: ${item.label}`} />;
  }
  if (item.value === "priority") {
    return <Chip size="small" color="warning" label={`PRO: ${item.label}`} />;
  }
  return <Chip size="small" variant="outlined" label={`PRO: ${item.label}`} />;
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD.MM.YYYY HH:mm");
}

export default function AdminClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canReview = user?.role === "admin";
  const canPriorityManage = user?.role === "admin" || user?.role === "master";

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [reviewDraftById, setReviewDraftById] = useState({});
  const [priorityDraftById, setPriorityDraftById] = useState({});
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
      setPriorityDraftById((prev) => {
        const next = { ...prev };
        items.forEach((row) => {
          if (!next[row.id]) {
            next[row.id] = {
              wholesale_priority: row.wholesale_priority || "standard",
              wholesale_priority_note: row.wholesale_priority_note || "",
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
    if (!canReview) return;
    setSavingId(id);
    try {
      await adminApi.ban(id, reasonById[id] || "");
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const unban = async (id) => {
    if (!canReview) return;
    setSavingId(id);
    try {
      await adminApi.unban(id);
      await load();
    } finally {
      setSavingId(0);
    }
  };

  const reviewWholesale = async (id, decision) => {
    if (!canReview) return;
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

  const updateWholesalePriority = async (id) => {
    if (!canPriorityManage) return;
    const draft = priorityDraftById[id] || {};
    const payload = {
      wholesale_priority: draft.wholesale_priority || "standard",
      wholesale_priority_note: (draft.wholesale_priority_note || "").trim(),
    };

    setSavingId(id);
    try {
      await adminApi.updateWholesalePriority(id, payload);
      await load();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(detail || "Не удалось обновить приоритет клиента");
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
        row.wholesale_priority_note,
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
        <Typography variant="h5">{canPriorityManage ? "Клиенты и Service Center PRO" : "Клиенты"}</Typography>
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
          const priorityDraft = priorityDraftById[row.id] || {
            wholesale_priority: row.wholesale_priority || "standard",
            wholesale_priority_note: row.wholesale_priority_note || "",
          };
          const company = (row.wholesale_company_name || "").trim();
          const city = (row.wholesale_city || "").trim();
          const address = (row.wholesale_address || "").trim();
          const serviceCenterPro = row.wholesale_status === "approved" || row.is_service_center;

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
                      {serviceCenterPro ? <Chip size="small" color="success" label="Service Center PRO" /> : null}
                      <WholesalePriorityChip value={row.wholesale_priority} />
                      {row.appointments_sla_breached ? (
                        <Chip size="small" color="error" variant="outlined" label={`SLA: ${row.appointments_sla_breached}`} />
                      ) : null}
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
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={`История: ${row.appointments_total || 0}`} />
                    <Chip size="small" variant="outlined" label={`Активные: ${row.appointments_active || 0}`} />
                    <Chip
                      size="small"
                      color={row.appointments_sla_breached ? "error" : "default"}
                      variant={row.appointments_sla_breached ? "filled" : "outlined"}
                      label={`SLA нарушено: ${row.appointments_sla_breached || 0}`}
                    />
                  </Stack>

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

                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Карточка сервисного центра
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          color={row.wholesale_verified_at ? "success" : "default"}
                          variant={row.wholesale_verified_at ? "filled" : "outlined"}
                          label={row.wholesale_verified_at ? "Верифицирован" : "Не верифицирован"}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Проверен: ${formatDateTime(row.wholesale_verified_at)}`}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Кем проверен: ${row.wholesale_verified_by_username || "—"}`}
                        />
                      </Stack>
                      <Typography variant="body2">
                        Название: <b>{row.wholesale_company_name || "—"}</b>
                      </Typography>
                      <Typography variant="body2">
                        Город: <b>{row.wholesale_city || "—"}</b>
                      </Typography>
                      <Typography variant="body2">
                        Адрес: <b>{row.wholesale_address || "—"}</b>
                      </Typography>
                    </Stack>
                  </Paper>

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

                  {canPriorityManage ? (
                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                      <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary">
                          Ручной приоритет Service Center PRO
                        </Typography>
                        <TextField
                          select
                          size="small"
                          label="Приоритет"
                          value={priorityDraft.wholesale_priority}
                          onChange={(event) =>
                            setPriorityDraftById((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...priorityDraft,
                                wholesale_priority: event.target.value,
                              },
                            }))
                          }
                        >
                          {WHOLESALE_PRIORITY_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label="Примечание к приоритету"
                          value={priorityDraft.wholesale_priority_note}
                          onChange={(event) =>
                            setPriorityDraftById((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...priorityDraft,
                                wholesale_priority_note: event.target.value,
                              },
                            }))
                          }
                          fullWidth
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isSaving}
                          onClick={() => updateWholesalePriority(row.id)}
                        >
                          Сохранить приоритет
                        </Button>
                      </Stack>
                    </Paper>
                  ) : null}

                  {canPriorityManage || canReview ? <Divider /> : null}

                  {canReview ? (
                    <TextField
                      size="small"
                      label="Причина бана"
                      value={reasonById[row.id] || row.ban_reason || ""}
                      onChange={(event) => setReasonById((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    />
                  ) : null}

                  {canReview ? (
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

                  {canReview ? (
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
