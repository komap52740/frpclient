import { useWebSocketChannel } from "../../../../shared/api/wsClient";
import { useAccessToken } from "../../../../shared/auth/tokenStore";

export function useMasterQueueRealtime({ enabled = true, onConnected, onQueueEvent }) {
  const accessToken = useAccessToken();

  return useWebSocketChannel({
    path: "/ws/master/queue/",
    enabled: enabled && Boolean(accessToken),
    onOpen: onConnected,
    onMessage: onQueueEvent,
  });
}
