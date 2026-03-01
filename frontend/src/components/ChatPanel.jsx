import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SendIcon from "@mui/icons-material/Send";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "txt", "log", "zip"];

const QUICK_TEMPLATES = {
  client: [
    "Я на месте, готов к подключению.",
    "Оплату отправил, проверьте пожалуйста.",
    "Не получается, нужна помощь пошагово.",
  ],
  master: [
    "Проверил данные, сейчас продолжаю работу.",
    "Нужен короткий доступ к ПК для следующего шага.",
    "Проверьте результат и дайте обратную связь.",
  ],
  admin: ["Подключили поддержку, сейчас поможем решить вопрос."],
};

function mapSystemEvents(systemEvents = []) {
  return (systemEvents || []).map((event) => ({
    type: "system_event",
    id: `system-${event.id}`,
    created_at: event.created_at,
    text: event.title || event.event_type || "Системное событие",
  }));
}

function validateAttachment(file) {
  if (!file) {
    return "";
  }

  const extension = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return "Файл должен быть в формате jpg/jpeg/png/pdf/txt/log/zip";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Размер файла не должен превышать 10 МБ";
  }

  return "";
}

function normalizeCommand(value) {
  const raw = (value || "").trim();
  if (!raw) {
    return "";
  }
  const withoutSlash = raw.startsWith("/") ? raw.slice(1) : raw;
  return withoutSlash.toLowerCase();
}

function splitCommandText(rawText) {
  const text = (rawText || "").trim();
  if (!text.startsWith("/") || text.startsWith("//")) {
    return null;
  }

  const firstToken = text.split(" ")[0];
  const command = normalizeCommand(firstToken);
  if (!command) {
    return null;
  }

  const tail = text.slice(firstToken.length).trim();
  return { command, tail };
}

const EMPTY_REPLY_FORM = {
  id: 0,
  command: "",
  title: "",
  text: "",
};

export default function ChatPanel({ appointmentId, currentUser, systemEvents = [] }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [quickReplies, setQuickReplies] = useState([]);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickReplyError, setQuickReplyError] = useState("");
  const [quickReplySaving, setQuickReplySaving] = useState(false);
  const [replyForm, setReplyForm] = useState(EMPTY_REPLY_FORM);

  const isMaster = currentUser.role === "master";
  const quickTemplates = QUICK_TEMPLATES[currentUser.role] || QUICK_TEMPLATES.client;

  const quickReplyMap = useMemo(() => {
    const map = new Map();
    quickReplies.forEach((item) => map.set(item.command, item));
    return map;
  }, [quickReplies]);

  const lastMessageId = useMemo(
    () => messages.reduce((maxId, message) => (typeof message.id === "number" && message.id > maxId ? message.id : maxId), 0),
    [messages]
  );

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

  const loadQuickReplies = useCallback(async () => {
    if (!isMaster) {
      setQuickReplies([]);
      return;
    }

    try {
      const response = await chatApi.listQuickReplies();
      setQuickReplies(response.data || []);
      setQuickReplyError("");
    } catch {
      setQuickReplyError("Не удалось загрузить быстрые ответы.");
    }
  }, [isMaster]);

  useEffect(() => {
    setMessages([]);
    loadMessages(0);
  }, [appointmentId, loadMessages]);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  useAutoRefresh(() => loadMessages(lastMessageId), { intervalMs: 4000 });

  useEffect(() => {
    if (!lastMessageId) return;
    chatApi.read(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  const resolveQuickReplyText = useCallback(
    (rawText) => {
      const normalized = (rawText || "").trim();
      if (!isMaster || !normalized) {
        return normalized;
      }
      if (normalized.startsWith("//")) {
        return normalized.slice(1);
      }

      const parsed = splitCommandText(normalized);
      if (!parsed) {
        return normalized;
      }

      const matched = quickReplyMap.get(parsed.command);
      if (!matched) {
        return normalized;
      }

      if (parsed.tail) {
        return `${matched.text}\n\n${parsed.tail}`;
      }
      return matched.text;
    },
    [isMaster, quickReplyMap]
  );

  const onSend = async () => {
    const rawText = text.trim();
    if (!rawText && !file) return;

    const attachmentError = validateAttachment(file);
    setFileError(attachmentError);
    if (attachmentError) {
      return;
    }

    const resolvedText = resolveQuickReplyText(rawText);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender: currentUser.id,
      sender_username: currentUser.username || "Вы",
      text: resolvedText,
      file_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const formData = new FormData();
    if (resolvedText) {
      formData.append("text", resolvedText);
    }
    if (file) {
      formData.append("file", file);
    }

    setText("");
    setFile(null);
    setFileError("");
    setIsSending(true);

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
    } finally {
      setIsSending(false);
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

  const applyTemplate = (templateText) => {
    setText((prev) => {
      if (!prev.trim()) {
        return templateText;
      }
      return `${prev.trim()} ${templateText}`;
    });
  };

  const applyQuickReplyCommand = (command) => {
    setText(`/${command}`);
  };

  const onFileChange = (nextFile) => {
    setFile(nextFile);
    setFileError(validateAttachment(nextFile));
  };

  const resetReplyForm = () => {
    setReplyForm(EMPTY_REPLY_FORM);
    setQuickReplyError("");
  };

  const startEditReply = (item) => {
    setReplyForm({
      id: item.id,
      command: `/${item.command}`,
      title: item.title || "",
      text: item.text || "",
    });
    setQuickReplyError("");
  };

  const saveQuickReply = async () => {
    const payload = {
      command: normalizeCommand(replyForm.command),
      title: (replyForm.title || "").trim(),
      text: (replyForm.text || "").trim(),
    };

    if (!payload.command || !payload.text) {
      setQuickReplyError("Заполните команду и текст шаблона.");
      return;
    }

    setQuickReplySaving(true);
    try {
      if (replyForm.id) {
        await chatApi.updateQuickReply(replyForm.id, payload);
      } else {
        await chatApi.createQuickReply(payload);
      }
      await loadQuickReplies();
      resetReplyForm();
    } catch (err) {
      setQuickReplyError(err?.response?.data?.detail || "Не удалось сохранить быстрый ответ.");
    } finally {
      setQuickReplySaving(false);
    }
  };

  const removeQuickReply = async (replyId) => {
    setQuickReplySaving(true);
    try {
      await chatApi.deleteQuickReply(replyId);
      await loadQuickReplies();
      if (replyForm.id === replyId) {
        resetReplyForm();
      }
    } catch (err) {
      setQuickReplyError(err?.response?.data?.detail || "Не удалось удалить быстрый ответ.");
    } finally {
      setQuickReplySaving(false);
    }
  };

  return (
    <Paper sx={{ p: 2.2 }}>
      <Typography variant="h3" sx={{ mb: 1.25 }}>
        Чат по заявке
      </Typography>

      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mb: 1.1 }}>
        {quickTemplates.map((template) => (
          <Chip
            key={template}
            label={template}
            variant="outlined"
            onClick={() => applyTemplate(template)}
            sx={{ cursor: "pointer" }}
          />
        ))}

        {isMaster
          ? quickReplies.map((item) => (
              <Chip
                key={item.id}
                label={item.title ? `/${item.command} — ${item.title}` : `/${item.command}`}
                color="primary"
                variant="outlined"
                onClick={() => applyQuickReplyCommand(item.command)}
                sx={{ cursor: "pointer" }}
              />
            ))
          : null}
      </Stack>

      {isMaster ? (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Быстрые команды мастера: введите `/команда`, например `/1`.
          </Typography>
          <Button
            size="small"
            startIcon={<SettingsRoundedIcon fontSize="small" />}
            onClick={() => setQuickRepliesOpen(true)}
          >
            Управлять
          </Button>
        </Stack>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
      {fileError ? <Alert severity="warning" sx={{ mb: 1 }}>{fileError}</Alert> : null}

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
          helperText={
            text.trim().length
              ? "Сообщение готово к отправке. Ctrl+Enter для быстрой отправки"
              : isMaster
                ? "Можно писать /команда (пример: /1). Ctrl+Enter для быстрой отправки"
                : "Выберите шаблон или напишите вручную. Ctrl+Enter для быстрой отправки"
          }
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
            Файл
            <input hidden type="file" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
          </Button>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {file ? file.name : "Файл не выбран"}
          </Typography>
          <Button variant="contained" onClick={onSend} endIcon={<SendIcon />} disabled={isSending || Boolean(fileError)}>
            {isSending ? "Отправка..." : "Отправить"}
          </Button>
        </Stack>
      </Stack>

      <Dialog open={quickRepliesOpen} onClose={() => setQuickRepliesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Быстрые ответы мастера</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography variant="body2" color="text.secondary">
              Создайте свои команды и используйте их в чате: `/1`, `/привет` и т.д.
            </Typography>

            {quickReplyError ? <Alert severity="error">{quickReplyError}</Alert> : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Команда"
                placeholder="/1"
                value={replyForm.command}
                onChange={(event) => setReplyForm((prev) => ({ ...prev, command: event.target.value }))}
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              />
              <TextField
                label="Название (опционально)"
                placeholder="Инструкция по установке"
                value={replyForm.title}
                onChange={(event) => setReplyForm((prev) => ({ ...prev, title: event.target.value }))}
                sx={{ flexGrow: 1 }}
              />
            </Stack>

            <TextField
              label="Текст шаблона"
              multiline
              minRows={3}
              value={replyForm.text}
              onChange={(event) => setReplyForm((prev) => ({ ...prev, text: event.target.value }))}
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={replyForm.id ? <EditRoundedIcon /> : <AddRoundedIcon />}
                onClick={saveQuickReply}
                disabled={quickReplySaving}
              >
                {replyForm.id ? "Сохранить" : "Добавить"}
              </Button>
              {replyForm.id ? (
                <Button variant="outlined" onClick={resetReplyForm} disabled={quickReplySaving}>
                  Новый шаблон
                </Button>
              ) : null}
            </Stack>

            <Divider />

            <Stack spacing={0.8}>
              {quickReplies.length ? (
                quickReplies.map((item) => (
                  <Box key={item.id} sx={{ p: 1.1, border: "1px solid #dce6f0", borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          /{item.command} {item.title ? `— ${item.title}` : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                          {item.text}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.3}>
                        <IconButton size="small" onClick={() => startEditReply(item)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => removeQuickReply(item.id)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Шаблонов пока нет. Добавьте первый быстрый ответ.
                </Typography>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickRepliesOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
