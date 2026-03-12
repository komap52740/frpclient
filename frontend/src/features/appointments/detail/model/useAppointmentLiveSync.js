import { useWebSocketChannel } from "../../../../shared/api/wsClient";
import { useAccessToken } from "../../../../shared/auth/tokenStore";

export function useAppointmentLiveSync({
  appointmentId,
  enabled = true,
  onConnected,
  onAppointmentEvent,
}) {
  const accessToken = useAccessToken();

  return useWebSocketChannel({
    path: appointmentId ? `/ws/appointments/${appointmentId}/events/` : "",
    enabled: enabled && Boolean(appointmentId) && Boolean(accessToken),
    onOpen: onConnected,
    onMessage: onAppointmentEvent,
  });
}
