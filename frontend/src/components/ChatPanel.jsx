import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { chatApi } from "../api/client";

export default function ChatPanel({ appointmentId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const lastMessageId = useMemo(() => {
    if (!messages.length) return 0;
    return messages[messages.length - 1].id;
  }, [messages]);

  const loadMessages = useCallback(
    async (afterId = 0) => {
      try {
        const response = await chatApi.listMessages(appointmentId, afterId);
        if (response.data.length) {
          setMessages((prev) => {
            const merged = [...prev, ...response.data];
            const dedup = new Map();
            merged.forEach((m) => dedup.set(m.id, m));
            return Array.from(dedup.values()).sort((a, b) => a.id - b.id);
          });
        }
      } catch (e) {
        setError("Не удалось загрузить сообщения");
      }
    },
    [appointmentId]
  );

  useEffect(() => {
    setMessages([]);
    loadMessages(0);
  }, [appointmentId, loadMessages]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMessages(lastMessageId);
    }, 4000);

    return () => clearInterval(timer);
  }, [loadMessages, lastMessageId]);

  useEffect(() => {
    if (!lastMessageId) return;
    chatApi.read(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  const onSend = async () => {
    if (!text.trim() && !file) return;
    const formData = new FormData();
    if (text.trim()) formData.append("text", text.trim());
    if (file) formData.append("file", file);

    try {
      const response = await chatApi.sendMessage(appointmentId, formData);
      setMessages((prev) => [...prev, response.data]);
      setText("");
      setFile(null);
      setError("");
    } catch {
      setError("Не удалось отправить сообщение")
    }
  };

  const onDelete = async (messageId) => {
    try {
      await chatApi.deleteMessage(messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true, text: null, file_url: null } : m)));
    } catch {
      setError("Не удалось удалить сообщение");
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" mb={2}>Чат по заявке</Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Stack spacing={1} sx={{ maxHeight: 360, overflowY: "auto", mb: 2, pr: 1 }}>
        {messages.map((m) => {
          const own = m.sender === currentUser.id;
          const canDelete = own || currentUser.role === "admin";
          return (
            <Box
              key={m.id}
              sx={{
                alignSelf: own ? "flex-end" : "flex-start",
                maxWidth: "85%",
                bgcolor: own ? "#d9f0ff" : "#f1f3f5",
                borderRadius: 2,
                p: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {m.sender_username}
              </Typography>
              <Typography variant="body2">
                {m.is_deleted ? "Сообщение удалено" : m.text}
              </Typography>
              {m.file_url && !m.is_deleted && (
                <Typography component="a" href={m.file_url} target="_blank" rel="noreferrer" sx={{ display: "block" }}>
                  Скачать файл
                </Typography>
              )}
              {canDelete && !m.is_deleted && (
                <IconButton size="small" onClick={() => onDelete(m.id)}>
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Stack>

      <Stack spacing={1}>
        <TextField
          label="Сообщение"
          multiline
          minRows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
            Файл
            <input
              hidden
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
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
