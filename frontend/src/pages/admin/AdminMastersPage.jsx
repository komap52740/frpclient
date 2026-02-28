import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { adminApi } from "../../api/client";

export default function AdminMastersPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await adminApi.masters();
      setRows(response.data);
      setError("");
    } catch {
      setError("Не удалось загрузить мастеров");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activate = async (id) => {
    await adminApi.activateMaster(id);
    await load();
  };

  const suspend = async (id) => {
    await adminApi.suspendMaster(id);
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Админ: управление мастерами</Typography>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Активность</TableCell>
              <TableCell>Действие</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.username}</TableCell>
                <TableCell>{row.is_master_active ? "Активен" : "Отключен"}</TableCell>
                <TableCell>
                  {row.is_master_active ? (
                    <Button size="small" color="warning" onClick={() => suspend(row.id)}>Отключить</Button>
                  ) : (
                    <Button size="small" color="success" onClick={() => activate(row.id)}>Активировать</Button>
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
