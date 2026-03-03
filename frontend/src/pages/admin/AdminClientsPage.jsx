import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
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
            next[row.id] = {
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
        <Typography variant="h5">{canManage ? "Клиенты и оптовый статус" : "Клиенты"}</Typography>
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

      <Stack spacing={1}>
        {filteredRows.map((row) => {
          const isSaving = savingId === row.id;
          const draft = reviewDraftById[row.id] || { review_comment: "" };

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
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {row.username}
                    </Typography>
                    <WholesaleStatusChip status={row.wholesale_status} />
                    {row.is_banned ? (
                      <Chip size="small" color="error" variant="outlined" label="Заблокирован" />
                    ) : null}
                  </Stack>
                  <Button size="small" variant="outlined" onClick={() => navigate(`/clients/${row.id}/profile`)}>
                    Профиль
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.1}>
                  {canManage ? (
                    <TextField
                      size="small"
                      label="Причина бана"
                      value={reasonById[row.id] || row.ban_reason || ""}
                      onChange={(e) => setReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                  ) : null}

                  {canManage ? (
                    <TextField
                      size="small"
                      label="Комментарий администратора"
                      value={draft.review_comment}
                      onChange={(e) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, review_comment: e.target.value },
                        }))
                      }
                      fullWidth
                    />
                  ) : null}

                  {row.wholesale_service_details ? (
                    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.2 }}>
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

