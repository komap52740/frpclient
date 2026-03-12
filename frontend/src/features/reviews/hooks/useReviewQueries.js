import { useQuery } from "@tanstack/react-query";

import { adminApi, reviewsApi } from "../../../api/client";
import { cleanQueryParams, queryKeys } from "../../../shared/api/queryKeys";

export function useAdminReviewsQuery(filters = {}, options = {}) {
  const params = cleanQueryParams(filters);

  return useQuery({
    queryKey: queryKeys.reviews.admin(params),
    queryFn: async () => {
      const response = await adminApi.reviews(params);
      return response.data || [];
    },
    ...options,
  });
}

export function useMasterReviewsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.reviews.my(),
    queryFn: async () => {
      const response = await reviewsApi.my();
      return response.data || [];
    },
    ...options,
  });
}
