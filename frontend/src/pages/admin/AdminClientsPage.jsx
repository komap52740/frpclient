import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { adminApi } from "../../api/client";

export default function AdminClientsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState({});

  const load = async () => {
    try {
      const response = await adminApi.clients();
      setRows(response.data);
      setError("");
    } catch {
      setError("Не удалось загрузить клиентов");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ban = async (id) => {
    await adminApi.ban(id, reasonById[id] || "");
    await load();
  };

  const unban = async (id) => {
    await adminApi.unban(id);
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Админ: баны клиентов</Typography>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Причина</TableCell>
              <TableCell>Действие</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.username}</TableCell>
                <TableCell>{row.is_banned ? "Забанен" : "Активен"}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={reasonById[row.id] || row.ban_reason || ""}
                    onChange={(e) => setReasonById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  {row.is_banned ? (
                    <Button size="small" color="success" onClick={() => unban(row.id)}>
                      Разбанить
                    </Button>
                  ) : (
                    <Button size="small" color="error" onClick={() => ban(row.id)}>
                      Забанить
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
