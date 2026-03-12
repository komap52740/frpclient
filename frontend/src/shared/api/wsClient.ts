import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

export type WebSocketStatus = "idle" | "connecting" | "open" | "error" | "closed";

interface UseWebSocketChannelOptions<TMessage = unknown> {
  path: string;
  enabled?: boolean;
  reconnectMs?: number;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (payload: TMessage) => void;
}

interface UseWebSocketChannelResult<TOutbound = unknown> {
  status: WebSocketStatus;
  sendJson: (payload: TOutbound) => boolean;
}

function trimTrailingSlash(value: string | undefined): string {
  return String(value || "").replace(/\/+$/, "");
}

function resolveWsBaseUrl(): string {
  const configured = trimTrailingSlash(import.meta.env.VITE_WS_BASE_URL);
  if (configured) {
    return configured;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export function buildWebSocketUrl(path: string): string {
  const baseUrl = resolveWsBaseUrl();
  if (!baseUrl || !path) {
    return "";
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${baseUrl}${normalizedPath}`).toString();
}

export function useWebSocketChannel<TMessage = unknown, TOutbound = unknown>({
  path,
  enabled = true,
  reconnectMs = 1500,
  onOpen,
  onClose,
  onError,
  onMessage,
}: UseWebSocketChannelOptions<TMessage>): UseWebSocketChannelResult<TOutbound> {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>("idle");

  const handleOpen = useEffectEvent(() => {
    onOpen?.();
  });
  const handleClose = useEffectEvent((event: CloseEvent) => {
    onClose?.(event);
  });
  const handleError = useEffectEvent((event: Event) => {
    onError?.(event);
  });
  const handleMessage = useEffectEvent((event: MessageEvent<string>) => {
    let payload: unknown = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    onMessage?.(payload as TMessage);
  });

  useEffect(() => {
    if (typeof window === "undefined" || !enabled || !path) {
      setStatus("idle");
      return undefined;
    }

    let disposed = false;

    const cleanupReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      cleanupReconnectTimer();

      const url = buildWebSocketUrl(path);
      if (!url) {
        setStatus("idle");
        return;
      }

      setStatus("connecting");
      const socket = new window.WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          return;
        }
        setStatus("open");
        handleOpen();
      };

      socket.onmessage = (event) => {
        if (disposed) {
          return;
        }
        handleMessage(event);
      };

      socket.onerror = (event) => {
        if (disposed) {
          return;
        }
        setStatus((prev) => (prev === "open" ? "error" : prev));
        handleError(event);
      };

      socket.onclose = (event) => {
        if (disposed) {
          return;
        }
        socketRef.current = null;
        setStatus("closed");
        handleClose(event);
        reconnectTimerRef.current = window.setTimeout(connect, reconnectMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      cleanupReconnectTimer();
      const activeSocket = socketRef.current;
      socketRef.current = null;
      if (activeSocket && activeSocket.readyState < window.WebSocket.CLOSING) {
        activeSocket.close();
      }
    };
  }, [enabled, handleClose, handleError, handleMessage, handleOpen, path, reconnectMs]);

  const sendJson = useCallback((payload: TOutbound): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== window.WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  return {
    status,
    sendJson,
  };
}
