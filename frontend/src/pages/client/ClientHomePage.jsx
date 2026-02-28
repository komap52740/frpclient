import { Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function ClientHomePage() {
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" mb={1}>Удалённая разблокировка телефона</Typography>
        <Typography variant="body1" color="text.secondary">
          Создайте заявку, дождитесь мастера, оплатите 100% предоплату по реквизитам и продолжайте работу в чате.
        </Typography>
      </Paper>

      <Button component={RouterLink} to="/client/create" variant="contained" sx={{ width: "fit-content" }}>
        Создать заявку
      </Button>
    </Stack>
  );
}
