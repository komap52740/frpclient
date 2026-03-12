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
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../api/client";

const ROLE_OPTIONS = [
  { value: "", label: "Все роли" },
  { value: "client", label: "Клиент" },
  { value: "master", label: "Мастер" },
  { value: "admin", label: "Админ" },
];

const ROLE_LABELS = {
  client: "Клиент",
  master: "Мастер",
  admin: "Админ",
};

function roleChip(role) {
  if (role === "admin") return <Chip size="small" color="warning" label="Админ" />;
  if (role === "master") return <Chip size="small" color="info" label="Мастер" />;
  return <Chip size="small" variant="outlined" label="Клиент" />;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState(0);
  const [editsById, setEditsById] = useState({});
  const [banReasonById, setBanReasonById] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const params = roleFilter ? { role: roleFilter } : {};
      const response = await adminApi.users(params);
      const items = response.data || [];
      setRows(items);
      setEditsById(
        Object.fromEntries(
          items.map((user) => [
            user.id,
            {
              role: user.role,
              is_master_active: Boolean(user.is_master_active),
            },
          ])
        )
      );
      setError("");
    } catch {
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roleFilter]);

  const saveUser = async (userId) => {
    const editData = editsById[userId];
    if (!editData) return;

    setSavingUserId(userId);
    try {
      const payload = { role: editData.role };
      if (editData.role === "master") payload.is_master_active = Boolean(editData.is_master_active);
      await adminApi.updateUserRole(userId, payload);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось сохранить изменения пользователя");
    } finally {
      setSavingUserId(0);
    }
  };

  const banUser = async (userId) => {
    setSavingUserId(userId);
    try {
      await adminApi.ban(userId, banReasonById[userId] || "");
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось заблокировать пользователя");
    } finally {
      setSavingUserId(0);
    }
  };

  const unbanUser = async (userId) => {
    setSavingUserId(userId);
    try {
      await adminApi.unban(userId);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Не удалось разблокировать пользователя");
    } finally {
      setSavingUserId(0);
    }
  };

  const titleText = useMemo(
    () => (loading ? "Загрузка..." : `Пользователей: ${rows.length}`),
    [loading, rows.length]
  );

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography variant="h5">Пользователи и роли</Typography>
        <Typography variant="body2" color="text.secondary">
          {titleText}
        </Typography>
      </Stack>

      <Paper sx={{ p: 1.5, borderRadius: 1.8 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select
            label="Фильтр по роли"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 220 }}
            size="small"
          >
            {ROLE_OPTIONS.map((item) => (
              <MenuItem key={item.value || "all"} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={load} disabled={loading}>
            Обновить
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1}>
        {rows.map((row) => {
          const editData = editsById[row.id] || {
            role: row.role,
            is_master_active: row.is_master_active,
          };
          const isSaving = savingUserId === row.id;
          const role = editData.role;

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
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {row.username}
                    </Typography>
                    {roleChip(row.role)}
                    {row.role === "client" && row.is_banned ? (
                      <Chip size="small" color="error" variant="outlined" label="Заблокирован" />
                    ) : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    ID {row.id}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.1}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Роль"
                      value={role}
                      onChange={(e) =>
                        setEditsById((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...editData,
                            role: e.target.value,
                            is_master_active:
                              e.target.value === "master" ? editData.is_master_active : false,
                          },
                        }))
                      }
                      sx={{ minWidth: 200 }}
                    >
                      {ROLE_OPTIONS.filter((item) => item.value).map((item) => (
                        <MenuItem key={item.value} value={item.value}>
                          {item.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    {role === "master" ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={Boolean(editData.is_master_active)}
                          onChange={(e) =>
                            setEditsById((prev) => ({
                              ...prev,
                              [row.id]: { ...editData, is_master_active: e.target.checked },
                            }))
                          }
                        />
                        <Typography variant="caption">
                          Активный мастер: {editData.is_master_active ? "Да" : "Нет"}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>

                  {row.role === "client" ? (
                    <TextField
                      size="small"
                      label="Причина блокировки"
                      value={banReasonById[row.id] || row.ban_reason || ""}
                      onChange={(e) =>
                        setBanReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                  ) : null}

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={isSaving}
                      onClick={() => saveUser(row.id)}
                    >
                      Сохранить роль
                    </Button>
                    {row.role === "client" && !row.is_banned ? (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={isSaving}
                        onClick={() => banUser(row.id)}
                      >
                        Заблокировать
                      </Button>
                    ) : null}
                    {row.role === "client" && row.is_banned ? (
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        disabled={isSaving}
                        onClick={() => unbanUser(row.id)}
                      >
                        Разблокировать
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Роли: {ROLE_LABELS.client}, {ROLE_LABELS.master}, {ROLE_LABELS.admin}. Нажмите на строку,
        чтобы открыть детали.
      </Typography>
    </Stack>
  );
}
