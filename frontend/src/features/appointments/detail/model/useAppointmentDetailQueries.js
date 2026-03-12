import { useQuery } from "@tanstack/react-query";

import { appointmentsApi } from "../../../../api/client";
import { queryKeys } from "../../../../shared/api/queryKeys";

export function useAppointmentDetailQuery(appointmentId, options = {}) {
  return useQuery({
    queryKey: queryKeys.appointments.detail(appointmentId),
    queryFn: async () => {
      const response = await appointmentsApi.detail(appointmentId);
      return response.data || null;
    },
    enabled: Boolean(appointmentId),
    ...options,
  });
}

export function useAppointmentEventsQuery(appointmentId, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.appointments.events(appointmentId, params),
    queryFn: async () => {
      const response = await appointmentsApi.events(appointmentId, params);
      return response.data || [];
    },
    enabled: Boolean(appointmentId),
    ...options,
  });
}
