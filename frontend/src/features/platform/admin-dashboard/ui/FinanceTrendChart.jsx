import { Stack, Typography } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AdminChartCard from "./AdminChartCard";
import { buildMetricsChartRows, formatRub } from "./chartUtils";

export default function FinanceTrendChart({ rows = [] }) {
  const data = buildMetricsChartRows(rows);

  return (
    <AdminChartCard
      title="GMV за 14 дней"
      subtitle="Фактический денежный поток по daily metrics."
      action={
        data.length ? (
          <Typography variant="caption" color="success.main">
            {formatRub(data[data.length - 1].gmv)}
          </Typography>
        ) : null
      }
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value) => formatRub(value)}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="gmv"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#gmvFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <Stack sx={{ minHeight: 220 }} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Для графика GMV пока нет собранных daily metrics.
          </Typography>
        </Stack>
      )}
    </AdminChartCard>
  );
}
