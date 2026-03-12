import { Stack, Typography } from "@mui/material";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AdminChartCard from "./AdminChartCard";
import { buildMetricsChartRows } from "./chartUtils";

export default function OpsLatencyChart({ rows = [] }) {
  const data = buildMetricsChartRows(rows);

  return (
    <AdminChartCard
      title="Latency сервиса"
      subtitle="Среднее время первого ответа и среднее время завершения."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={54} />
            <Tooltip
              formatter={(value, name) => (name === "Ответ" ? `${value} мин` : `${value} ч`)}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="responseMinutes"
              name="Ответ"
              stroke="#ea580c"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="completionHours"
              name="Завершение"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Stack sx={{ minHeight: 220 }} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Средняя latency появится после запуска сборщика daily metrics.
          </Typography>
        </Stack>
      )}
    </AdminChartCard>
  );
}
