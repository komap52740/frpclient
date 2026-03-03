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

function WholesaleStatusChip({ status, discountPercent = 0 }) {
  if (status === "approved") return <Chip size="small" color="success" label={`Опт: одобрено (${discountPercent || 0}%)`} />;
  if (status === "pending") return <Chip size="small" color="warning" variant="outlined" label="Опт: на рассмотрении" />;
  if (status === "rejected") return <Chip size="small" color="error" variant="outlined" label="Опт: отклонено" />;
  return <Chip size="small" variant="outlined" label="Опт: не запрошено" />;
}

export default function AdminClientsPage() {
  const navigate = useNavigate();
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
    if (decision === "approve") payload.discount_percent = Number(draft.discount_percent || 0);

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
        <Typography variant="h5">Клиенты и оптовый статус</Typography>
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
          const draft = reviewDraftById[row.id] || { discount_percent: 10, review_comment: "" };
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{row.username}</Typography>
                    <WholesaleStatusChip status={row.wholesale_status} discountPercent={row.wholesale_discount_percent} />
                    {row.is_banned ? <Chip size="small" color="error" variant="outlined" label="Заблокирован" /> : null}
                  </Stack>
                  <Button size="small" variant="outlined" onClick={() => navigate(`/clients/${row.id}/profile`)}>
                    Профиль
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.1}>
                  <TextField
                    size="small"
                    label="Причина бана"
                    value={reasonById[row.id] || row.ban_reason || ""}
                    onChange={(e) => setReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Скидка, %"
                      type="number"
                      inputProps={{ min: 0, max: 90 }}
                      value={draft.discount_percent}
                      onChange={(e) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, discount_percent: e.target.value },
                        }))
                      }
                      sx={{ width: { xs: "100%", sm: 160 } }}
                    />
                    <TextField
                      size="small"
                      label="Комментарий админа"
                      value={draft.review_comment}
                      onChange={(e) =>
                        setReviewDraftById((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, review_comment: e.target.value },
                        }))
                      }
                      fullWidth
                    />
                  </Stack>

                  {row.wholesale_service_details ? (
                    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.2 }}>
                      <Typography variant="caption" color="text.secondary">Описание сервиса</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {row.wholesale_service_details}
                      </Typography>
                    </Paper>
                  ) : null}
                  {(row.wholesale_service_photo_1_url || row.wholesale_service_photo_2_url) ? (
                    <Stack direction="row" spacing={1}>
                      {row.wholesale_service_photo_1_url ? (
                        <Link href={row.wholesale_service_photo_1_url} target="_blank" rel="noreferrer">Фото 1</Link>
                      ) : null}
                      {row.wholesale_service_photo_2_url ? (
                        <Link href={row.wholesale_service_photo_2_url} target="_blank" rel="noreferrer">Фото 2</Link>
                      ) : null}
                    </Stack>
                  ) : null}

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
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Stack>
  );
}
