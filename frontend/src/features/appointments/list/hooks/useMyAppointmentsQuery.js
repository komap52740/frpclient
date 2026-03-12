import { useQuery } from "@tanstack/react-query";

import { appointmentsApi } from "../../../../api/client";
import { queryKeys } from "../../../../shared/api/queryKeys";

export function useMyAppointmentsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.appointments.my(),
    queryFn: async () => {
      const response = await appointmentsApi.my();
      return response.data || [];
    },
    ...options,
  });
}
