import { useQuery } from "@tanstack/react-query";

import { authApi } from "../api/authApi";

export function useBootstrapStatusQuery() {
  return useQuery({
    queryKey: ["auth", "bootstrap-status"],
    queryFn: authApi.bootstrapStatus,
    staleTime: 5 * 60 * 1000,
  });
}
