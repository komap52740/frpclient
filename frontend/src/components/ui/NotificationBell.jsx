import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { Badge, IconButton, Tooltip } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keyframes } from "@mui/system";

import { notificationsApi } from "../../api/client";
import useAutoRefresh from "../../hooks/useAutoRefresh";
import NotificationsDrawer from "./NotificationsDrawer";

const bellPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .35); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
`;

const NOTIFICATION_POLL_INTERVAL_MS = 7000;

function resolveNotificationKind(notification) {
  const payload = notification?.payload || {};
  const eventType = String(payload?.event_type || "").toLowerCase();
  const title = String(notification?.title || "").toLowerCase();
  const message = String(notification?.message || "").toLowerCase();
  const merged = `${eventType} ${title} ${message}`;

  if (merged.includes("chat.message_sent") || merged.includes("сообщен")) return "message";
  if (merged.includes("sla")) return "sla";
  if (notification?.type === "payment" || merged.includes("оплат")) return "payment";
  if (merged.includes("назнач") || merged.includes("taken")) return "assignment";
  return "default";
}

function requestAudioContext(audioContextRef) {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  let audioCtx = audioContextRef.current;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContextCtor();
    audioContextRef.current = audioCtx;
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function playEnvelope(audioCtx, frequency, offsetSeconds, durationSeconds = 0.12, type = "sine", gainPeak = 0.04) {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const startAt = audioCtx.currentTime + offsetSeconds;
  const endAt = startAt + durationSeconds;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gainPeak, startAt + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function playTypedNotificationSound(kind, audioContextRef) {
  try {
    const audioCtx = requestAudioContext(audioContextRef);
    if (!audioCtx) return;

    if (kind === "message") {
      playEnvelope(audioCtx, 760, 0.0, 0.11, "triangle", 0.038);
      playEnvelope(audioCtx, 900, 0.13, 0.1, "triangle", 0.032);
      return;
    }
    if (kind === "sla") {
      playEnvelope(audioCtx, 460, 0.0, 0.12, "sawtooth", 0.048);
      playEnvelope(audioCtx, 460, 0.16, 0.12, "sawtooth", 0.048);
      playEnvelope(audioCtx, 460, 0.32, 0.12, "sawtooth", 0.048);
      return;
    }
    if (kind === "payment") {
      playEnvelope(audioCtx, 640, 0.0, 0.1, "sine", 0.035);
      playEnvelope(audioCtx, 820, 0.12, 0.12, "sine", 0.038);
      return;
    }
    if (kind === "assignment") {
      playEnvelope(audioCtx, 560, 0.0, 0.12, "triangle", 0.034);
      playEnvelope(audioCtx, 700, 0.15, 0.12, "triangle", 0.034);
      return;
    }

    playEnvelope(audioCtx, 620, 0.0, 0.11, "triangle", 0.03);
  } catch {
    // Browser can block audio until first interaction.
  }
}

function showBrowserPush(notification) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;
  if (!document.hidden) return;

  const browserNotification = new window.Notification(notification.title || "Новое уведомление", {
    body: notification.message || "Откройте уведомления в кабинете.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `frp-notification-${notification.id}`,
  });

  browserNotification.onclick = () => {
    window.focus();
    const appointmentId = notification?.payload?.appointment_id;
    if (appointmentId) {
      window.location.href = `/appointments/${appointmentId}`;
    }
    browserNotification.close();
  };
}

export default function NotificationBell({ buttonSx = {} }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seenUnreadIdsRef = useRef(new Set());
  const initializedUnreadRef = useRef(false);
  const audioContextRef = useRef(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.list();
      setItems(response.data || []);
      setError("");
    } catch {
      setError("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, []);

  const processUnreadSnapshot = useCallback((unreadItems) => {
    const nextIds = new Set(unreadItems.map((item) => item.id));
    if (!initializedUnreadRef.current) {
      initializedUnreadRef.current = true;
      seenUnreadIdsRef.current = nextIds;
      return;
    }

    const newItems = unreadItems.filter((item) => !seenUnreadIdsRef.current.has(item.id));
    seenUnreadIdsRef.current = nextIds;
    if (!newItems.length) return;

    const latest = newItems[0];
    const kind = resolveNotificationKind(latest);
    playTypedNotificationSound(kind, audioContextRef);
    showBrowserPush(latest);
  }, []);

  const pollUnread = useCallback(async () => {
    try {
      const response = await notificationsApi.list({ is_read: 0 });
      const unreadItems = Array.isArray(response.data) ? response.data : [];
      setUnreadCount(unreadItems.length);
      processUnreadSnapshot(unreadItems);
    } catch {
      // Silent polling fallback to keep header stable.
    }
  }, [processUnreadSnapshot]);

  useEffect(() => {
    pollUnread();
  }, [pollUnread]);

  useAutoRefresh(pollUnread, { intervalMs: NOTIFICATION_POLL_INTERVAL_MS });

  useEffect(
    () => () => {
      const audioCtx = audioContextRef.current;
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => undefined);
      }
    },
    []
  );

  const requestPushPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      try {
        await window.Notification.requestPermission();
      } catch {
        // Do nothing; drawer still works without push permission.
      }
    }
  }, []);

  const openDrawer = async () => {
    requestAudioContext(audioContextRef);
    await requestPushPermission();
    setOpen(true);
    await loadItems();
    await pollUnread();
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await loadItems();
      await pollUnread();
    } catch {
      setError("Не удалось отметить уведомления прочитанными");
    }
  };

  const markSingleRead = async (notificationId) => {
    try {
      await notificationsApi.markRead([notificationId]);
      setItems((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(prev - 1, 0));
      if (seenUnreadIdsRef.current.has(notificationId)) {
        seenUnreadIdsRef.current.delete(notificationId);
      }
    } catch {
      setError("Не удалось обновить уведомление");
    }
  };

  const cappedUnread = useMemo(() => (unreadCount > 99 ? "99+" : unreadCount), [unreadCount]);

  return (
    <>
      <Tooltip title="Уведомления">
        <IconButton
          color="inherit"
          onClick={openDrawer}
          sx={{
            border: unreadCount ? "1px solid" : "1px solid transparent",
            borderColor: unreadCount ? "error.light" : "transparent",
            bgcolor: unreadCount ? "rgba(239,68,68,0.08)" : "transparent",
            ...buttonSx,
          }}
        >
          <Badge
            color="error"
            badgeContent={cappedUnread}
            invisible={!unreadCount}
            sx={{
              "& .MuiBadge-badge": unreadCount
                ? {
                    animation: `${bellPulse} 1.9s infinite`,
                    transformOrigin: "center",
                  }
                : undefined,
            }}
          >
            <NotificationsRoundedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <NotificationsDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        loading={loading}
        error={error}
        onRefresh={loadItems}
        onMarkAllRead={markAllRead}
        onMarkRead={markSingleRead}
      />
    </>
  );
}
