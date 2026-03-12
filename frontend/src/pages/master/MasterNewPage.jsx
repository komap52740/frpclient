import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import EmptyState from "../../components/EmptyState";
import KpiCard from "../../components/KpiCard";
import AppointmentCardSkeleton from "../../components/ui/skeletons/AppointmentCardSkeleton";
import {
  getUrgentItemCount,
  useInboxFilters,
} from "../../features/appointments/master-inbox/hooks/useInboxFilters";
import {
  useMasterActiveAppointmentsQuery,
  useMasterNewAppointmentsQuery,
  useTakeAppointmentMutation,
} from "../../features/appointments/master-inbox/hooks/useMasterInboxQueries";
import { useMasterQueueRealtime } from "../../features/appointments/master-inbox/hooks/useMasterQueueRealtime";
import { MASTER_NEW_BOARD_COLUMNS } from "../../features/appointments/master-inbox/model/boardColumns";
import InboxFilters from "../../features/appointments/master-inbox/ui/InboxFilters";
import MasterInboxBoard from "../../features/appointments/master-inbox/ui/MasterInboxBoard";
import { useDashboardSummaryQuery } from "../../features/dashboard/hooks/useDashboardSummaryQuery";
import { queryKeys } from "../../shared/api/queryKeys";

function resolveTakeError(error) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") {
    return data.detail;
  }
  if (typeof data === "string") {
    return data;
  }
  return "Не удалось взять заявку в работу";
}

export default function MasterNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filters = useInboxFilters({ defaultSortBy: "priority" });

  const {
    data: newItems = [],
    isPending: newPending,
    isFetching: newFetching,
    error: newError,
    refetch: refetchNewItems,
  } = useMasterNewAppointmentsQuery();
  const {
    data: activeItems = [],
    isPending: activePending,
    isFetching: activeFetching,
    refetch: refetchActiveItems,
  } = useMasterActiveAppointmentsQuery();
  const {
    data: summary = null,
    isPending: summaryPending,
    isFetching: summaryFetching,
    error: summaryError,
    refetch: refetchSummary,
  } = useDashboardSummaryQuery();

  const takeMutation = useTakeAppointmentMutation();

  const loading = newPending || activePending || summaryPending;
  const refreshing = newFetching || activeFetching || summaryFetching || takeMutation.isPending;
  const error = newError || summaryError ? "Не удалось загрузить очередь новых заявок" : "";

  const refreshData = useCallback(async () => {
    await Promise.all([refetchNewItems(), refetchActiveItems(), refetchSummary()]);
  }, [refetchActiveItems, refetchNewItems, refetchSummary]);

  const invalidateData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.newRoot() });
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.activeRoot() });
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.dashboardRoot() });
  }, [queryClient]);

  useMasterQueueRealtime({
    onConnected: invalidateData,
    onQueueEvent: invalidateData,
  });

  const inReviewItems = useMemo(
    () => activeItems.filter((item) => item.status === "IN_REVIEW"),
    [activeItems]
  );

  const filteredNewItems = useMemo(() => filters.applyItems(newItems), [filters, newItems]);
  const filteredInReviewItems = useMemo(
    () => filters.applyItems(inReviewItems),
    [filters, inReviewItems]
  );
  const urgentCount = useMemo(() => getUrgentItemCount(newItems), [newItems]);
  const wholesaleCount = useMemo(
    () => newItems.filter((item) => item.is_wholesale_request).length,
    [newItems]
  );
  const boardItems = useMemo(
    () => ({
      new: filteredNewItems,
      in_review: filteredInReviewItems,
    }),
    [filteredInReviewItems, filteredNewItems]
  );

  const focusItem = filteredNewItems[0] || filteredInReviewItems[0] || null;

  const handleMoveCard = async ({ appointmentId, fromColumnId, toColumnId }) => {
    if (fromColumnId !== "new" || toColumnId !== "in_review") {
      return;
    }

    await takeMutation.mutateAsync(appointmentId);
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
          <Typography variant="h5">Новые заявки</Typography>
          <Typography variant="body2" color="text.secondary">
            Рабочая канбан-очередь мастера: фильтруйте поток и перетаскивайте карточку в колонку «В
            работе сейчас», чтобы сразу взять заказ.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={urgentCount ? "warning" : "default"}
            variant={urgentCount ? "filled" : "outlined"}
            label={`Срочных: ${urgentCount}`}
          />
          <Chip
            size="small"
            color={wholesaleCount ? "primary" : "default"}
            variant="outlined"
            label={`B2B: ${wholesaleCount}`}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={refreshData}
            disabled={refreshing}
          >
            Обновить
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ width: "100%", m: 0, minWidth: 0 }}>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard
            title="Доступно новых"
            value={summary?.new_available ?? newItems.length}
            accent="#15616d"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard
            title="В работе мастера"
            value={summary?.active_total ?? activeItems.length}
            accent="#2e8a66"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiCard title="На ревью" value={inReviewItems.length} accent="#c97a00" />
        </Grid>
      </Grid>

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
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Typography variant="body2" color="text.secondary">
            {
              "Drag & drop работает только для перехода NEW -> IN_REVIEW. Остальные статусы по-прежнему меняются внутри карточки заявки, чтобы не терять доменную логику цены и оплаты."
            }
          </Typography>
          {focusItem ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate(`/appointments/${focusItem.id}`)}
            >
              Открыть фокусную заявку
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {takeMutation.isError ? (
        <Alert severity="error">{resolveTakeError(takeMutation.error)}</Alert>
      ) : null}

      {loading && !newItems.length && !inReviewItems.length ? (
        <Stack spacing={1.25}>
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </Stack>
      ) : filteredNewItems.length || filteredInReviewItems.length ? (
        <MasterInboxBoard
          columns={MASTER_NEW_BOARD_COLUMNS}
          itemsByColumn={boardItems}
          draggableColumnIds={["new"]}
          onMoveCard={handleMoveCard}
          onOpenCard={(item) => navigate(`/appointments/${item.id}`)}
        />
      ) : (
        <EmptyState
          title="Новых заявок по текущим фильтрам нет"
          description="Сбросьте фильтры, подождите новую очередь или обновите экран вручную."
          actionLabel="Обновить"
          onAction={refreshData}
        />
      )}
    </Stack>
  );
}
