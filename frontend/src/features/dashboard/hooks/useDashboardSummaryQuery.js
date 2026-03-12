import { useQuery } from "@tanstack/react-query";

import { authApi } from "../../../api/client";
import { queryKeys } from "../../../shared/api/queryKeys";

export function useDashboardSummaryQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.auth.dashboard(),
    queryFn: async () => {
      const data = await authApi.dashboardSummary();
      return data.counts || {};
    },
    ...options,
  });
}
