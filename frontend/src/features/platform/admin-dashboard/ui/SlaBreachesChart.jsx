import { Stack, Typography } from "@mui/material";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import AdminChartCard from "./AdminChartCard";
import { buildWeeklyChartRows } from "./chartUtils";

export default function SlaBreachesChart({ weeklyReport = null }) {
  const data = buildWeeklyChartRows(weeklyReport?.daily || []);

  return (
    <AdminChartCard
      title="SLA и проблемные кейсы"
      subtitle="Дневной разрез: создано, закрыто, с breach по SLA."
      action={
        weeklyReport ? (
          <Typography
            variant="caption"
            color={(weeklyReport.sla_breached_count || 0) > 0 ? "warning.main" : "text.secondary"}
          >
            SLA breach: {weeklyReport.sla_breached_count || 0}
          </Typography>
        ) : null
      }
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <Tooltip />
            <Bar dataKey="total" name="Создано" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="closed" name="Закрыто" fill="#0f766e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="slaBreached" name="SLA breach" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Stack sx={{ minHeight: 220 }} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Недельный график SLA появится после накопления weekly report данных.
          </Typography>
        </Stack>
      )}
    </AdminChartCard>
  );
}
