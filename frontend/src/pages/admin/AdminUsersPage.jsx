import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  Switch,
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

const ROLE_OPTIONS = [
  { value: "", label: "Все роли" },
  { value: "client", label: "Клиент" },
  { value: "master", label: "Мастер" },
  { value: "admin", label: "Администратор" },
];

const ROLE_LABELS = {
  client: "Клиент",
  master: "Мастер",
  admin: "Администратор",
};

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "-";
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
      setRows(response.data);
      setEditsById(
        Object.fromEntries(
          response.data.map((user) => [
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const saveUser = async (userId) => {
    const editData = editsById[userId];
    if (!editData) {
      return;
    }

    const payload = { role: editData.role };
    if (editData.role === "master") {
      payload.is_master_active = Boolean(editData.is_master_active);
    }

    setSavingUserId(userId);
    try {
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

  const rowCountText = useMemo(() => {
    if (loading) {
      return "Загрузка...";
    }
    return `Всего: ${rows.length}`;
  }, [loading, rows.length]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
        <Typography variant="h5">Админ: пользователи и роли</Typography>
        <Typography variant="body2" color="text.secondary">{rowCountText}</Typography>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            select
            label="Фильтр по роли"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {ROLE_OPTIONS.map((item) => (
              <MenuItem key={item.value || "all"} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={load} disabled={loading}>Обновить</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Имя</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell>Активный мастер</TableCell>
              <TableCell>Блокировка</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const editData = editsById[row.id] || { role: row.role, is_master_active: row.is_master_active };
              const isSaving = savingUserId === row.id;
              const role = editData.role;

              return (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "-"}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={role}
                      onChange={(e) =>
                        setEditsById((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...editData,
                            role: e.target.value,
                            is_master_active: e.target.value === "master" ? editData.is_master_active : false,
                          },
                        }))
                      }
                      sx={{ minWidth: 180 }}
                    >
                      {ROLE_OPTIONS.filter((item) => item.value).map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Switch
                        checked={Boolean(editData.is_master_active)}
                        disabled={role !== "master"}
                        onChange={(e) =>
                          setEditsById((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...editData,
                              is_master_active: e.target.checked,
                            },
                          }))
                        }
                      />
                      <Typography variant="caption">{role === "master" ? (editData.is_master_active ? "Да" : "Нет") : "-"}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {row.role === "client" ? (
                      <Stack spacing={0.75}>
                        <Typography variant="caption">{row.is_banned ? "Заблокирован" : "Активен"}</Typography>
                        <TextField
                          size="small"
                          label="Причина"
                          value={banReasonById[row.id] || row.ban_reason || ""}
                          onChange={(e) => setBanReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        />
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Для клиентов</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" disabled={isSaving} onClick={() => saveUser(row.id)}>
                        Сохранить роль
                      </Button>
                      {row.role === "client" && !row.is_banned ? (
                        <Button size="small" color="error" disabled={isSaving} onClick={() => banUser(row.id)}>
                          Заблокировать
                        </Button>
                      ) : null}
                      {row.role === "client" && row.is_banned ? (
                        <Button size="small" color="success" disabled={isSaving} onClick={() => unbanUser(row.id)}>
                          Разблокировать
                        </Button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        Роли: {getRoleLabel("client")}, {getRoleLabel("master")}, {getRoleLabel("admin")}. Изменения применяются кнопкой «Сохранить роль».
      </Typography>
    </Stack>
  );
}
