import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { Badge, IconButton, Tooltip } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { notificationsApi } from "../../api/client";
import useAutoRefresh from "../../hooks/useAutoRefresh";
import NotificationsDrawer from "./NotificationsDrawer";

export default function NotificationBell() {
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
      setItems(response.data || []);
      setError("");
    } catch {
      setError("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, []);

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
        <IconButton color="inherit" onClick={openDrawer}>
          <Badge color="error" badgeContent={cappedUnread} invisible={!unreadCount}>
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
