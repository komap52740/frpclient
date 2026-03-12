import { useQuery } from "@tanstack/react-query";

import { chatApi } from "../../../api/client";
import { queryKeys } from "../../../shared/api/queryKeys";

export function useAppointmentMessagesQuery(appointmentId, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.chat.messages(appointmentId, params),
    queryFn: async () => {
      const response = await chatApi.listMessages(appointmentId, params.after_id || 0);
      return response.data || [];
    },
    enabled: Boolean(appointmentId),
    ...options,
  });
}
