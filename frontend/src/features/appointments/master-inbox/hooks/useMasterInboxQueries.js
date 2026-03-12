import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminApi, appointmentsApi } from "../../../../api/client";
import { queryKeys } from "../../../../shared/api/queryKeys";

export function useMasterNewAppointmentsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.appointments.newList(),
    queryFn: async () => {
      const response = await appointmentsApi.newList();
      return response.data || [];
    },
    ...options,
  });
}

export function useMasterActiveAppointmentsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.appointments.activeList(),
    queryFn: async () => {
      const response = await appointmentsApi.activeList();
      return response.data || [];
    },
    ...options,
  });
}

export function useMasterFinanceSummaryQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.admin.financeSummary(),
    queryFn: async () => {
      const response = await adminApi.financeSummary();
      return response.data || null;
    },
    ...options,
  });
}

export function useMasterWeeklyReportQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.admin.weeklyReport(),
    queryFn: async () => {
      const response = await adminApi.weeklyReport();
      return response.data || null;
    },
    ...options,
  });
}

export function useTakeAppointmentMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appointmentId) => appointmentsApi.take(appointmentId),
    onSuccess: async (...args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.newRoot() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.activeRoot() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.dashboardRoot() }),
      ]);

      if (options.onSuccess) {
        await options.onSuccess(...args);
      }
    },
    ...options,
  });
}
