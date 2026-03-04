import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { Badge, IconButton, Tooltip } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keyframes } from "@mui/system";

import { notificationsApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import useAutoRefresh from "../../hooks/useAutoRefresh";
import NotificationsDrawer from "./NotificationsDrawer";

const bellPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .35); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
`;

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationsApi.unreadCount();
      setUnreadCount(response.data?.unread_count || 0);
    } catch {
      // Silent counter failure to avoid noisy header state.
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.list();
      const nextItems = (response.data || []).filter((item) => {
        if (!user) return true;
        if (user.role !== "admin" && String(item?.title || "").trim() === "Новая оптовая заявка") {
          return false;
        }
        const payloadClientId = item?.payload?.client_id;
        if (user.role === "client" && payloadClientId && Number(payloadClientId) !== Number(user.id)) {
          return false;
        }
        return true;
      });
      setItems(nextItems);
      setError("");
    } catch {
      setError("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useAutoRefresh(loadUnreadCount, { intervalMs: 7000 });

  const openDrawer = async () => {
    setOpen(true);
    await loadItems();
    await loadUnreadCount();
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await loadItems();
      await loadUnreadCount();
    } catch {
      setError("Не удалось отметить уведомления прочитанными");
    }
  };

  const markSingleRead = async (notificationId) => {
    try {
      await notificationsApi.markRead([notificationId]);
      setItems((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(prev - 1, 0));
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
