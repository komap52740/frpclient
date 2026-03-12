import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appointmentsApi } from "../../api/client";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import {
  getUrgentItemCount,
  useInboxFilters,
} from "../../features/appointments/master-inbox/hooks/useInboxFilters";
import {
  useMasterActiveAppointmentsQuery,
  useMasterFinanceSummaryQuery,
  useMasterWeeklyReportQuery,
} from "../../features/appointments/master-inbox/hooks/useMasterInboxQueries";
import { useMasterQueueRealtime } from "../../features/appointments/master-inbox/hooks/useMasterQueueRealtime";
import { MASTER_ACTIVE_BOARD_COLUMNS } from "../../features/appointments/master-inbox/model/boardColumns";
import InboxFilters from "../../features/appointments/master-inbox/ui/InboxFilters";
import MasterActiveBoard from "../../features/appointments/master-inbox/ui/MasterActiveBoard";
import { useDashboardSummaryQuery } from "../../features/dashboard/hooks/useDashboardSummaryQuery";
import { queryKeys } from "../../shared/api/queryKeys";

const BULK_ACTION_OPTIONS = [
  { value: "send_template", label: "Шаблонный ответ" },
  { value: "start_work", label: "Старт работы (PAID -> IN_PROGRESS)" },
  { value: "complete_work", label: "Завершить работу (IN_PROGRESS -> COMPLETED)" },
];

function formatRub(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function formatDuration(valueSeconds) {
  const seconds = Number(valueSeconds || 0);
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} мин`;
}

function groupActiveItemsByStatus(items) {
  const grouped = Object.fromEntries(MASTER_ACTIVE_BOARD_COLUMNS.map((column) => [column.id, []]));
  items.forEach((item) => {
    if (!grouped[item.status]) {
      grouped[item.status] = [];
    }
    grouped[item.status].push(item);
  });
  return grouped;
}

export default function MasterActivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filters = useInboxFilters({ defaultSortBy: "priority" });

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("send_template");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const {
    data: activeItems = [],
    isPending: activePending,
    isFetching: activeFetching,
    error: activeError,
    refetch: refetchActiveItems,
  } = useMasterActiveAppointmentsQuery();
  const {
    data: _summary = null,
    isPending: summaryPending,
    isFetching: summaryFetching,
    error: summaryError,
    refetch: refetchSummary,
  } = useDashboardSummaryQuery();
  const {
    data: financeSummary = null,
    isFetching: financeFetching,
    refetch: refetchFinanceSummary,
  } = useMasterFinanceSummaryQuery();
  const {
    data: weeklyReport = null,
    isFetching: weeklyFetching,
    refetch: refetchWeeklyReport,
  } = useMasterWeeklyReportQuery();

  const loading = activePending || summaryPending;
  const refreshing =
    activeFetching || summaryFetching || financeFetching || weeklyFetching || bulkBusy;
  const error = activeError || summaryError ? "Не удалось загрузить активные заявки мастера" : "";

  const refreshData = useCallback(async () => {
    await Promise.all([
      refetchActiveItems(),
      refetchSummary(),
      refetchFinanceSummary(),
      refetchWeeklyReport(),
    ]);
  }, [refetchActiveItems, refetchFinanceSummary, refetchSummary, refetchWeeklyReport]);

  const invalidateData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.activeRoot() });
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.dashboardRoot() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.financeRoot() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.weeklyRoot() });
  }, [queryClient]);

  useMasterQueueRealtime({
    onConnected: invalidateData,
    onQueueEvent: invalidateData,
  });

  const filteredItems = useMemo(() => filters.applyItems(activeItems), [activeItems, filters]);
  const groupedItems = useMemo(() => groupActiveItemsByStatus(filteredItems), [filteredItems]);
  const urgentCount = useMemo(() => getUrgentItemCount(activeItems), [activeItems]);
  const wholesaleCount = useMemo(
    () => activeItems.filter((item) => item.is_wholesale_request).length,
    [activeItems]
  );
  const unreadCount = useMemo(
    () => activeItems.filter((item) => (item.unread_count || 0) > 0).length,
    [activeItems]
  );

  const filteredIdSet = useMemo(
    () => new Set(filteredItems.map((item) => item.id)),
    [filteredItems]
  );
  const selectedCount = selectedIds.length;
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  const toggleSelectOne = (appointmentId) => {
    setSelectedIds((prev) => {
      if (prev.includes(appointmentId)) {
        return prev.filter((id) => id !== appointmentId);
      }
      return [...prev, appointmentId];
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  const runBulkAction = async () => {
    if (!selectedCount || bulkBusy) return;
    setBulkBusy(true);
    setBulkResult(null);

    try {
      const response = await appointmentsApi.bulkAction({
        appointment_ids: selectedIds,
        action: bulkAction,
        message_text: bulkMessage,
      });
      setBulkResult(response.data || null);
      if (bulkAction === "send_template") {
        setBulkMessage("");
      }
      await refreshData();
    } catch (requestError) {
      setBulkResult({
        error: requestError?.response?.data?.detail || "Не удалось выполнить bulk-действие",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Stack spacing={0.25}>
          <Typography variant="h5">Активные заявки</Typography>
          <Typography variant="body2" color="text.secondary">
            Это рабочая доска мастера по статусам. Отсюда удобно держать SLA, оплаченные заявки и
            текущие сессии в одном поле зрения.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={urgentCount ? "warning" : "default"}
            variant={urgentCount ? "filled" : "outlined"}
            label={`Срочных: ${urgentCount}`}
          />
          <Chip size="small" variant="outlined" label={`Непрочитанных: ${unreadCount}`} />
          <Chip
            size="small"
            color={wholesaleCount ? "primary" : "default"}
            variant="outlined"
            label={`B2B: ${wholesaleCount}`}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={refreshData}
            disabled={refreshing}
          >
            Обновить
          </Button>
        </Stack>
      </Stack>

      {financeSummary ? (
        <Paper sx={{ p: 1.2, borderRadius: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Финансовый блок
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`Оплачено: ${formatRub(financeSummary.paid_total)}`}
              />
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={`В работе: ${formatRub(financeSummary.in_work_total)}`}
              />
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`За период: ${formatRub(financeSummary.period_total)}`}
              />
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {weeklyReport ? (
        <Paper sx={{ p: 1.2, borderRadius: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Недельный отчет
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="outlined"
                label={`SLA нарушено: ${weeklyReport.sla_breached_count || 0}`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Ответ: ${formatDuration(weeklyReport.avg_first_response_seconds)}`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Закрыто: ${weeklyReport.closed_count || 0}`}
              />
              <Chip
                size="small"
                color={(weeklyReport.problematic_cases_count || 0) > 0 ? "warning" : "default"}
                variant={(weeklyReport.problematic_cases_count || 0) > 0 ? "filled" : "outlined"}
                label={`Проблемные кейсы: ${weeklyReport.problematic_cases_count || 0}`}
              />
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <InboxFilters
        searchQuery={filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        riskLevel={filters.riskLevel}
        setRiskLevel={filters.setRiskLevel}
        sortBy={filters.sortBy}
        setSortBy={filters.setSortBy}
        urgentOnly={filters.urgentOnly}
        setUrgentOnly={filters.setUrgentOnly}
        wholesaleOnly={filters.wholesaleOnly}
        setWholesaleOnly={filters.setWholesaleOnly}
        unreadOnly={filters.unreadOnly}
        setUnreadOnly={filters.setUnreadOnly}
      />

      <Paper sx={{ p: 1.4, borderRadius: 2 }}>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Bulk-действия по очереди
            </Typography>
            <Chip
              size="small"
              variant={selectedCount ? "filled" : "outlined"}
              color={selectedCount ? "primary" : "default"}
              label={`Выбрано: ${selectedCount}`}
            />
            <Button size="small" variant="outlined" onClick={toggleSelectAllFiltered}>
              {allFilteredSelected ? "Снять выделение" : "Выбрать все по фильтру"}
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 300 } }}>
              <InputLabel id="bulk-action-label">Действие</InputLabel>
              <Select
                labelId="bulk-action-label"
                label="Действие"
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
              >
                {BULK_ACTION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              fullWidth
              label="Текст сообщения для шаблонного ответа"
              value={bulkMessage}
              onChange={(event) => setBulkMessage(event.target.value)}
            />

            <Button
              variant="contained"
              disabled={
                bulkBusy ||
                !selectedCount ||
                (bulkAction === "send_template" && !bulkMessage.trim())
              }
              onClick={runBulkAction}
            >
              {bulkBusy ? "Применяем..." : "Применить"}
            </Button>
          </Stack>

          {bulkResult?.error ? <Alert severity="error">{bulkResult.error}</Alert> : null}
          {bulkResult?.processed_count != null ? (
            <Alert severity="success">
              Обработано: {bulkResult.processed_count}. Пропущено: {bulkResult.skipped?.length || 0}
              .
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 1.4, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Доска сгруппирована по фактическим статусам мастера: `IN_REVIEW`, `AWAITING_PAYMENT`,
          `PAYMENT_PROOF_UPLOADED`, `PAID`, `IN_PROGRESS`. Это упрощает контроль очереди без
          постоянного ручного поиска.
        </Typography>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading && !activeItems.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : filteredItems.length ? (
        <MasterActiveBoard
          columns={MASTER_ACTIVE_BOARD_COLUMNS}
          itemsByColumn={groupedItems}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectOne}
          onOpenCard={(item) => navigate(`/appointments/${item.id}`)}
          onOpenChat={(item) => navigate(`/appointments/${item.id}?focus=chat`)}
        />
      ) : (
        <Alert severity="info">По текущим фильтрам активных заявок нет.</Alert>
      )}
    </Stack>
  );
}
