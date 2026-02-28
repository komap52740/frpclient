import { Alert, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { appointmentsApi } from "../../api/client";
import AppointmentCard from "../../components/AppointmentCard";

export default function MyAppointmentsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await appointmentsApi.my();
        setItems(response.data);
      } catch {
        setError("Не удалось загрузить список заявок");
      }
    }
    load();
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Мои заявки</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {items.map((item) => (
        <AppointmentCard key={item.id} item={item} linkTo={`/appointments/${item.id}`} />
      ))}
    </Stack>
  );
}
