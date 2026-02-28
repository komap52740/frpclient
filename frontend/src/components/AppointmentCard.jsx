import { Badge, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import StatusChip from "./StatusChip";

export default function AppointmentCard({ item, linkTo }) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">#{item.id} {item.brand} {item.model}</Typography>
          <StatusChip status={item.status} />
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={1}>
          {item.description}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={1}>
          <Typography variant="caption" color="text.secondary">
            Клиент: {item.client_username || item.client || "-"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Мастер: {item.master_username || item.assigned_master || "-"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Цена: {item.total_price ? `${item.total_price} ₽` : "не назначена"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Badge color="secondary" badgeContent={item.unread_count || 0}>
            <Typography variant="body2">Непрочитанные</Typography>
          </Badge>
          <Button component={RouterLink} to={linkTo} variant="contained" size="small">
            Открыть
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
