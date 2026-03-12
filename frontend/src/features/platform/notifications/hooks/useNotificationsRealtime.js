import { useWebSocketChannel } from "../../../../shared/api/wsClient";
import { useAccessToken } from "../../../../shared/auth/tokenStore";

export function useNotificationsRealtime({ enabled = true, onConnected, onNotification }) {
  const accessToken = useAccessToken();

  return useWebSocketChannel({
    path: "/ws/notifications/",
    enabled: enabled && Boolean(accessToken),
    onOpen: onConnected,
    onMessage: onNotification,
  });
}
