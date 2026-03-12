import { useWebSocketChannel } from "../../../shared/api/wsClient";
import { useAccessToken } from "../../../shared/auth/tokenStore";

export function useChatRealtime({ appointmentId, enabled = true, onConnected, onChatEvent }) {
  const accessToken = useAccessToken();

  return useWebSocketChannel({
    path: appointmentId ? `/ws/appointments/${appointmentId}/chat/` : "",
    enabled: enabled && Boolean(appointmentId) && Boolean(accessToken),
    onOpen: onConnected,
    onMessage: onChatEvent,
  });
}
