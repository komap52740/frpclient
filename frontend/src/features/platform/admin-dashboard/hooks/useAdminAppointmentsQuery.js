import { useQuery } from "@tanstack/react-query";

import { adminApi } from "../../../../api/client";
import { cleanQueryParams, queryKeys } from "../../../../shared/api/queryKeys";

export function useAdminAppointmentsQuery(filters = {}, options = {}) {
  const params = cleanQueryParams(filters);

  return useQuery({
    queryKey: queryKeys.admin.appointments(params),
    queryFn: async () => {
      const response = await adminApi.appointments(params);
      return response.data || [];
    },
    ...options,
  });
}
