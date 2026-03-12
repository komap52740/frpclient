import { Stack, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AdminChartCard from "./AdminChartCard";
import { buildMetricsChartRows } from "./chartUtils";

export default function AppointmentStatusChart({ rows = [] }) {
  const data = buildMetricsChartRows(rows);

  return (
    <AdminChartCard
      title="Воронка заявок"
      subtitle="Новые, оплаченные и завершенные кейсы по дням."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="newAppointments"
              name="Новые"
              stackId="flow"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="paidAppointments"
              name="Оплаченные"
              stackId="flow"
              fill="#0f766e"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="completedAppointments"
              name="Завершенные"
              stackId="flow"
              fill="#7c3aed"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Stack sx={{ minHeight: 220 }} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Ежедневная воронка появится после накопления daily metrics.
          </Typography>
        </Stack>
      )}
    </AdminChartCard>
  );
}
