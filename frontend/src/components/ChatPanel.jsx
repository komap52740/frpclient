import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";

import { chatApi } from "../api/client";
import useAutoRefresh from "../hooks/useAutoRefresh";
import ChatThread from "./ui/ChatThread";

dayjs.locale("ru");

function mapSystemEvents(systemEvents = []) {
  return (systemEvents || []).map((event) => ({
    type: "system_event",
    id: `system-${event.id}`,
    created_at: event.created_at,
    text: event.title || event.event_type || "Системное событие",
  }));
}

export default function ChatPanel({ appointmentId, currentUser, systemEvents = [] }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const lastMessageId = useMemo(() => {
    return messages.reduce((maxId, message) => (typeof message.id === "number" && message.id > maxId ? message.id : maxId), 0);
  }, [messages]);

  const threadItems = useMemo(() => {
    const messageItems = messages.map((message) => ({ ...message, type: "message" }));
    const eventItems = mapSystemEvents(systemEvents);
    return [...messageItems, ...eventItems].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
  }, [messages, systemEvents]);

  const loadMessages = useCallback(
    async (afterId = 0) => {
      try {
        const response = await chatApi.listMessages(appointmentId, afterId);
        if (response.data.length) {
          setMessages((prev) => {
            const merged = [...prev.filter((item) => !item.is_pending), ...response.data];
            const dedup = new Map();
            merged.forEach((message) => dedup.set(String(message.id), message));
            return Array.from(dedup.values()).sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
          });
        }
      } catch {
        setError("Не удалось загрузить сообщения");
      }
    },
    [appointmentId]
  );

  useEffect(() => {
    setMessages([]);
    loadMessages(0);
  }, [appointmentId, loadMessages]);

  useAutoRefresh(() => loadMessages(lastMessageId), { intervalMs: 4000 });

  useEffect(() => {
    if (!lastMessageId) return;
    chatApi.read(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  const onSend = async () => {
    const cleanText = text.trim();
    if (!cleanText && !file) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender: currentUser.id,
      sender_username: currentUser.username || "Вы",
      text: cleanText,
      file_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const formData = new FormData();
    if (cleanText) {
      formData.append("text", cleanText);
    }
    if (file) {
      formData.append("file", file);
    }

    setText("");
    setFile(null);

    try {
      const response = await chatApi.sendMessage(appointmentId, formData);
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticId);
        return [...withoutOptimistic, response.data].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
      });
      setError("");
    } catch {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setError("Не удалось отправить сообщение");
    }
  };

  const onDelete = async (messageId) => {
    try {
      await chatApi.deleteMessage(messageId);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, is_deleted: true, text: null, file_url: null }
            : message
        )
      );
    } catch {
      setError("Не удалось удалить сообщение");
    }
  };

  return (
    <Paper sx={{ p: 2.2 }}>
      <Typography variant="h3" sx={{ mb: 1.25 }}>
        Чат по заявке
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

      <ChatThread
        items={threadItems}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        onDeleteMessage={onDelete}
      />

      <Stack spacing={1} sx={{ mt: 1.75 }}>
        <TextField
          label="Сообщение"
          multiline
          minRows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
          helperText="Ctrl+Enter для быстрой отправки"
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
            Файл
            <input hidden type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {file ? file.name : "Файл не выбран"}
          </Typography>
          <Button variant="contained" onClick={onSend} endIcon={<SendIcon />}>
            Отправить
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
