export function formatCompactDate(value) {
  if (!value) return "—";
  return value.slice(5).replace("-", ".");
}

export function formatRub(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₽`;
}

export function formatMinutesFromSeconds(value) {
  const minutes = Math.round(Number(value || 0) / 60);
  return `${minutes} мин`;
}

export function buildMetricsChartRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    dateLabel: formatCompactDate(row.date),
    gmv: Number(row.gmv_total || 0),
    newAppointments: Number(row.new_appointments || 0),
    paidAppointments: Number(row.paid_appointments || 0),
    completedAppointments: Number(row.completed_appointments || 0),
    responseMinutes: Math.round(Number(row.avg_time_to_first_response || 0) / 60),
    completionHours: Number((Number(row.avg_time_to_complete || 0) / 3600).toFixed(1)),
    conversionPercent: Math.round(Number(row.conversion_new_to_paid || 0) * 100),
  }));
}

export function buildWeeklyChartRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    dateLabel: formatCompactDate(row.date),
    total: Number(row.total || 0),
    closed: Number(row.closed || 0),
    slaBreached: Number(row.sla_breached || 0),
  }));
}
