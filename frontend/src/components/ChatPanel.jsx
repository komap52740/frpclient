import AttachFileIcon from "@mui/icons-material/AttachFile";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { chatApi } from "../api/client";
import useAutoRefresh from "../hooks/useAutoRefresh";
import ChatThread from "./ui/ChatThread";

dayjs.locale("ru");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "txt", "log", "zip", "webp", "mp4", "mov", "webm", "m4v"];
const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi;
const LINK_SOURCE_ROLES = new Set(["master", "admin"]);

function mapSystemEvents(systemEvents = []) {
  const seen = new Set();
  return (systemEvents || [])
    .filter((event) => {
      const timestamp = dayjs(event.created_at).isValid()
        ? dayjs(event.created_at).format("YYYY-MM-DDTHH:mm:ss")
        : String(event.created_at || "");
      const fingerprint = [
        event.event_type || "",
        event.from_status || "",
        event.to_status || "",
        event.actor || "",
        timestamp,
        event.title || "",
      ].join("|");
      if (seen.has(fingerprint)) {
        return false;
      }
      seen.add(fingerprint);
      return true;
    })
    .map((event) => ({
      type: "system_event",
      id: `system-${event.id}`,
      created_at: event.created_at,
      text: event.title || event.event_type || "Системное событие",
    }));
}
function validateAttachment(file) {
  if (!file) return "";

  const extension = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return "Файл должен быть в формате jpg/jpeg/png/pdf/txt/log/zip/webp/mp4/mov/webm";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Размер файла не должен превышать 10 МБ";
  }
  return "";
}

function normalizeUrl(rawUrl) {
  const url = String(rawUrl || "").trim().replace(/[),.;!?]+$/g, "");
  return url;
}

function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(URL_REGEX) || [];
  return matches.map(normalizeUrl).filter(Boolean);
}

function buildLinkItems(messages = []) {
  const items = [];
  const seen = new Set();

  messages.forEach((message) => {
    if (message.is_deleted) return;
    if (!LINK_SOURCE_ROLES.has(String(message.sender_role || "").toLowerCase())) return;

    extractUrls(message.text).forEach((url, index) => {
      const key = `${message.id}-${url}-${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        id: key,
        url,
        sender_username: message.sender_username || "Пользователь",
        created_at: message.created_at,
      });
    });
  });

  return items.sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
}

function shouldPlayIncomingMessageSound(message, currentUser) {
  if (!message || message.sender === currentUser?.id) return false;

  const currentRole = String(currentUser?.role || "").toLowerCase();
  const senderRole = String(message.sender_role || "").toLowerCase();
  if (currentRole === "client") {
    return senderRole === "master" || senderRole === "admin";
  }

  return true;
}

export default function ChatPanel({
  appointmentId,
  currentUser,
  systemEvents = [],
  initialView = "messages",
  downloadLinks = [],
  ruDesktop = null,
  canEditRuDesktop = false,
  onSaveRuDesktop = null,
  ruDesktopSaving = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [chatView, setChatView] = useState(initialView === "links" ? "links" : "messages");
  const [newIncomingCount, setNewIncomingCount] = useState(0);
  const [ruDesktopForm, setRuDesktopForm] = useState({ rustdesk_id: "", rustdesk_password: "" });
  const [ruDesktopError, setRuDesktopError] = useState("");
  const [ruDesktopSuccess, setRuDesktopSuccess] = useState("");

  const threadRef = useRef(null);
  const sendAudioContextRef = useRef(null);
  const hasLoadedInitialBatchRef = useRef(false);

  const isClientRole = currentUser.role === "client";
  const isSplitClientLayout = isClientRole && !isMobile;

  const safeDownloadLinks = useMemo(
    () => (downloadLinks || []).filter((item) => item?.href && item?.label),
    [downloadLinks]
  );

  const lastMessageId = useMemo(
    () => messages.reduce((maxId, message) => (typeof message.id === "number" && message.id > maxId ? message.id : maxId), 0),
    [messages]
  );

  const threadItems = useMemo(() => {
    const messageItems = messages.map((message) => ({ ...message, type: "message" }));
    const eventItems = mapSystemEvents(systemEvents);
    return [...messageItems, ...eventItems].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
  }, [messages, systemEvents]);

  const linkItems = useMemo(() => buildLinkItems(messages), [messages]);

  const isNearBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(
    async (afterId = 0) => {
      try {
        const response = await chatApi.listMessages(appointmentId, afterId);
        if (response.data.length) {
          const shouldStickToBottom = isNearBottom();
          const hasForeignMessages = response.data.some((item) => item.sender !== currentUser.id);
          const hasIncomingMessagesForSound = response.data.some((item) =>
            shouldPlayIncomingMessageSound(item, currentUser)
          );

          setMessages((prev) => {
            const merged = [...prev.filter((item) => !item.is_pending), ...response.data];
            const dedup = new Map();
            merged.forEach((message) => dedup.set(String(message.id), message));
            return Array.from(dedup.values()).sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
          });

          if (afterId === 0) {
            hasLoadedInitialBatchRef.current = true;
          } else if (hasLoadedInitialBatchRef.current && hasIncomingMessagesForSound) {
            playIncomingMessageSound();
          }

          if (afterId === 0 || shouldStickToBottom) {
            setNewIncomingCount(0);
            window.requestAnimationFrame(scrollToBottom);
          } else if (hasForeignMessages) {
            setNewIncomingCount((prev) => prev + response.data.filter((item) => item.sender !== currentUser.id).length);
          }
        }
      } catch {
        setError("Не удалось загрузить сообщения");
      }
    },
    [appointmentId, currentUser.id, currentUser.role, isNearBottom, scrollToBottom]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const unlockAudio = () => {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        let audioCtx = sendAudioContextRef.current;
        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = new AudioContextCtor();
          sendAudioContextRef.current = audioCtx;
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => undefined);
        }
      } catch {
        // Browser may still block audio. Chat behavior must remain unaffected.
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    setMessages([]);
    setNewIncomingCount(0);
    setChatView(initialView === "links" ? "links" : "messages");
    loadMessages(0);
  }, [appointmentId, initialView, loadMessages]);

  useEffect(() => {
    setChatView(initialView === "links" ? "links" : "messages");
  }, [initialView]);

  useAutoRefresh(() => loadMessages(lastMessageId), { intervalMs: 2500 });

  useEffect(() => {
    if (!lastMessageId) return;
    chatApi.read(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  const onThreadScroll = useCallback(() => {
    if (isNearBottom()) {
      setNewIncomingCount(0);
    }
  }, [isNearBottom]);

  const playSendMessageSound = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;

      let audioCtx = sendAudioContextRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioContextCtor();
        sendAudioContextRef.current = audioCtx;
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => undefined);
      }

      const now = audioCtx.currentTime;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(860, now);
      oscillator.frequency.exponentialRampToValueAtTime(640, now + 0.1);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    } catch {
      // Silent fallback: chat should work even if audio is blocked by browser policy.
    }
  }, []);

  const playIncomingMessageSound = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;

      let audioCtx = sendAudioContextRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioContextCtor();
        sendAudioContextRef.current = audioCtx;
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => undefined);
      }

      const now = audioCtx.currentTime;
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscA.type = "sine";
      oscB.type = "triangle";
      oscA.frequency.setValueAtTime(740, now);
      oscA.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      oscB.frequency.setValueAtTime(520, now);
      oscB.frequency.exponentialRampToValueAtTime(640, now + 0.08);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      oscA.connect(gainNode);
      oscB.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + 0.17);
      oscB.stop(now + 0.17);
    } catch {
      // Silent fallback when browser blocks audio.
    }
  }, []);

  const onSend = async () => {
    const rawText = text.trim();
    if (!rawText && !file) return;

    const attachmentError = validateAttachment(file);
    setFileError(attachmentError);
    if (attachmentError) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender: currentUser.id,
      sender_username: currentUser.username || "Вы",
      sender_role: currentUser.role || "",
      text: rawText,
      file_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const formData = new FormData();
    if (rawText) formData.append("text", rawText);
    if (file) formData.append("file", file);

    playSendMessageSound();

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
      setNewIncomingCount(0);
      window.requestAnimationFrame(scrollToBottom);
      setError("");
    } catch (sendError) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setError(sendError?.response?.data?.detail || "Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(
    () => () => {
      const audioCtx = sendAudioContextRef.current;
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => undefined);
      }
    },
    []
  );

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

  const onFileChange = (nextFile) => {
    setFile(nextFile);
    setFileError(validateAttachment(nextFile));
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError("Не удалось скопировать ссылку");
    }
  };

  const copyText = async (text, errorText = "Не удалось скопировать") => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
    } catch {
      setError(errorText);
    }
  };

  const hasRuDesktopCard = Boolean(
    ruDesktop?.id || ruDesktop?.password || ruDesktop?.downloadUrl || ruDesktop?.helpUrl
  );
  const ruDesktopId = String(ruDesktop?.id || "").trim();
  const ruDesktopPassword = String(ruDesktop?.password || "").trim();

  useEffect(() => {
    setRuDesktopForm({
      rustdesk_id: ruDesktopId,
      rustdesk_password: ruDesktopPassword,
    });
  }, [ruDesktopId, ruDesktopPassword]);

  const openRuDesktopApp = () => {
    if (!ruDesktopId) {
      setError("Логин/ID RuDesktop не указан");
      return;
    }
    const encodedId = encodeURIComponent(ruDesktopId);
    const encodedPassword = encodeURIComponent(ruDesktopPassword);
    const uriCandidates = ruDesktopPassword
      ? [
          `rudesktop://${encodedId}?password=${encodedPassword}`,
          `rudesktop://${encodedId}`,
          `rustdesk://${encodedId}?password=${encodedPassword}`,
          `rustdesk://${encodedId}`,
        ]
      : [`rudesktop://${encodedId}`, `rustdesk://${encodedId}`];

    const [primaryUri, ...fallbackUris] = uriCandidates;
    window.location.href = primaryUri;
    fallbackUris.forEach((uri, index) => {
      window.setTimeout(() => {
        if (!document.hidden) {
          window.location.href = uri;
        }
      }, 450 * (index + 1));
    });
  };

  const saveRuDesktopInline = async () => {
    const payload = {
      rustdesk_id: String(ruDesktopForm.rustdesk_id || "").trim(),
      rustdesk_password: String(ruDesktopForm.rustdesk_password || "").trim(),
    };
    if (!payload.rustdesk_id && !payload.rustdesk_password) {
      setRuDesktopError("Укажите логин/ID и/или пароль RuDesktop");
      setRuDesktopSuccess("");
      return;
    }
    if (typeof onSaveRuDesktop !== "function") {
      setRuDesktopError("Сохранение RuDesktop сейчас недоступно");
      setRuDesktopSuccess("");
      return;
    }
    try {
      await onSaveRuDesktop(payload);
      setRuDesktopError("");
      setRuDesktopSuccess("Данные RuDesktop сохранены");
    } catch (saveError) {
      const detail =
        saveError?.response?.data?.detail ||
        saveError?.message ||
        "Не удалось сохранить данные RuDesktop";
      setRuDesktopError(detail);
      setRuDesktopSuccess("");
    }
  };

  const linksPanel = (
    <Paper
      variant="outlined"
      sx={{
        p: 1.1,
        borderRadius: 1.4,
        maxHeight: isMobile ? 400 : 460,
        overflowY: "auto",
        bgcolor: isDark ? alpha("#0f172a", 0.7) : alpha("#f8fbff", 0.95),
      }}
    >
      {linkItems.length ? (
        <Stack spacing={0.9}>
          {linkItems.map((item) => (
            <Paper
              key={item.id}
              elevation={0}
              sx={{
                p: 1,
                borderRadius: 1.2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? alpha("#111b2f", 0.8) : "#ffffff",
              }}
            >
              <Stack spacing={0.45}>
                <Typography variant="caption" color="text.secondary">
                  {item.sender_username} • {dayjs(item.created_at).format("DD.MM.YYYY HH:mm")}
                </Typography>
                <Typography
                  component="a"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  variant="body2"
                  sx={{
                    color: "primary.main",
                    fontWeight: 700,
                    textDecoration: "none",
                    wordBreak: "break-all",
                  }}
                >
                  {item.url}
                </Typography>
                <Stack direction="row" spacing={0.8}>
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                    onClick={() => copyLink(item.url)}
                  >
                    Копировать
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Пока нет ссылок от мастера или администратора.
        </Typography>
      )}
    </Paper>
  );

  const ruDesktopPanel = hasRuDesktopCard ? (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 1.3,
        borderColor: "divider",
        bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
      }}
    >
      <Stack spacing={0.7}>
        <Typography variant="caption" color="text.secondary">
          RuDesktop доступ
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          <b>Логин/ID:</b> {ruDesktopId || "не указан"}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          <b>Пароль:</b> {ruDesktopPassword || "не указан"}
        </Typography>
      </Stack>
    </Paper>
  ) : null;

  const ruDesktopInputPanel =
    canEditRuDesktop ? (
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          borderRadius: 1.3,
          borderColor: "divider",
          bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
        }}
      >
        <Stack spacing={0.8}>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <ComputerRoundedIcon fontSize="small" color="primary" />
            <Typography variant="caption" color="text.secondary">
              Данные RuDesktop (не чат)
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Здесь указываются только логин/ID и пароль RuDesktop. Сообщение пишите в поле "Сообщение мастеру" ниже.
          </Typography>
          {ruDesktopError ? (
            <Alert severity="error" sx={{ py: 0, "& .MuiAlert-message": { py: 0.25 } }}>
              {ruDesktopError}
            </Alert>
          ) : null}
          {ruDesktopSuccess ? (
            <Alert severity="success" sx={{ py: 0, "& .MuiAlert-message": { py: 0.25 } }}>
              {ruDesktopSuccess}
            </Alert>
          ) : null}
          <TextField
            size="small"
            label="Логин/ID RuDesktop"
            placeholder="Например: 123 456 789"
            value={ruDesktopForm.rustdesk_id}
            onChange={(event) => {
              setRuDesktopForm((prev) => ({
                ...prev,
                rustdesk_id: event.target.value.replace(/[^\d\s-]/g, ""),
              }));
              setRuDesktopError("");
              setRuDesktopSuccess("");
            }}
            autoComplete="off"
          />
          <TextField
            size="small"
            label="Пароль RuDesktop"
            placeholder="Пароль для подключения"
            value={ruDesktopForm.rustdesk_password}
            onChange={(event) => {
              setRuDesktopForm((prev) => ({
                ...prev,
                rustdesk_password: event.target.value,
              }));
              setRuDesktopError("");
              setRuDesktopSuccess("");
            }}
            autoComplete="off"
          />
          <Button
            size="small"
            variant="contained"
            onClick={saveRuDesktopInline}
            disabled={ruDesktopSaving}
            sx={{ alignSelf: "flex-start", borderRadius: 1.1 }}
          >
            {ruDesktopSaving ? "Сохраняем..." : "Сохранить RuDesktop"}
          </Button>
        </Stack>
      </Paper>
    ) : null;

  return (
    <Paper
      sx={{
        p: { xs: 1.4, sm: 2 },
        borderRadius: 1.6,
        overflow: "hidden",
        background: isDark
          ? "linear-gradient(160deg, rgba(10,17,31,0.92) 0%, rgba(17,24,39,0.88) 100%)"
          : "linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(250,252,255,0.86) 100%)",
      }}
    >
      <Stack spacing={1.1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h3">Чат по заявке</Typography>
          <Chip
            size="small"
            icon={<LinkRoundedIcon />}
            label={isSplitClientLayout ? `Ссылок: ${linkItems.length}` : `Ссылки: ${linkItems.length}`}
            variant="outlined"
          />
        </Stack>

        {!isSplitClientLayout ? (
          <Tabs
            value={chatView}
            onChange={(_, value) => setChatView(value)}
            variant="fullWidth"
            sx={{
              borderRadius: 1.4,
              bgcolor: (themeValue) =>
                themeValue.palette.mode === "dark" ? alpha("#0f172a", 0.66) : alpha("#e5eefb", 0.62),
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                textTransform: "none",
                fontWeight: 700,
              },
            }}
          >
            <Tab value="messages" label="Сообщения" />
            <Tab value="links" label={`Ссылки (${linkItems.length})`} />
          </Tabs>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
        {fileError ? <Alert severity="warning">{fileError}</Alert> : null}
        {file && !fileError ? <Alert severity="success">Файл готов к отправке: {file.name}</Alert> : null}

        {isSplitClientLayout ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.35fr) minmax(250px, 0.9fr)",
              gap: 1.2,
              alignItems: "start",
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 0.8,
                borderRadius: 1.3,
                bgcolor: isDark ? alpha("#0f172a", 0.56) : alpha("#f8fbff", 0.72),
              }}
            >
              {newIncomingCount > 0 ? (
                <Button
                  size="small"
                  variant="contained"
                  sx={{ alignSelf: "flex-start", boxShadow: 2, mb: 0.8 }}
                  onClick={() => {
                    setNewIncomingCount(0);
                    scrollToBottom();
                  }}
                >
                  Новые сообщения: {newIncomingCount}
                </Button>
              ) : null}

              <ChatThread
                items={threadItems}
                currentUserId={currentUser.id}
                currentUserRole={currentUser.role}
                onDeleteMessage={onDelete}
                onCopyFileLink={copyLink}
                containerRef={threadRef}
                onScroll={onThreadScroll}
              />
            </Paper>
            <Stack spacing={0.6}>
              {ruDesktopPanel}
              {ruDesktopInputPanel}
              {safeDownloadLinks.length ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderRadius: 1.3,
                    borderColor: "divider",
                    bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
                  }}
                >
                  <Stack spacing={0.55}>
                    <Typography variant="caption" color="text.secondary">
                      Ссылки для работы
                    </Typography>
                    {safeDownloadLinks.map((item) => (
                      <Button
                        key={`dl-${item.id || item.href}`}
                        size="small"
                        variant="outlined"
                        component="a"
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ justifyContent: "flex-start", borderRadius: 1.1 }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              ) : null}
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.2 }}>
                Ссылки из чата
              </Typography>
              {linksPanel}
            </Stack>
          </Box>
        ) : chatView === "messages" ? (
          <>
            {newIncomingCount > 0 ? (
              <Button
                size="small"
                variant="contained"
                sx={{ alignSelf: "flex-start", boxShadow: 2 }}
                onClick={() => {
                  setNewIncomingCount(0);
                  scrollToBottom();
                }}
              >
                Новые сообщения: {newIncomingCount}
              </Button>
            ) : null}

            <ChatThread
              items={threadItems}
              currentUserId={currentUser.id}
              currentUserRole={currentUser.role}
              onDeleteMessage={onDelete}
              onCopyFileLink={copyLink}
              containerRef={threadRef}
              onScroll={onThreadScroll}
            />
          </>
        ) : (
          linksPanel
        )}

        <Paper
          elevation={0}
          sx={{
            mt: 0.2,
            p: 1,
            borderRadius: 1.3,
            border: "1px solid",
            borderColor: "divider",
            position: isMobile ? "sticky" : "static",
            bottom: isMobile ? 2 : "auto",
            zIndex: 4,
            backdropFilter: "blur(10px)",
            background: isDark ? "rgba(12,18,31,0.9)" : "rgba(255,255,255,0.92)",
          }}
        >
          <Stack spacing={1}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Сообщение мастеру
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Пишите сообщение здесь. Поля RuDesktop находятся ниже отдельным блоком.
              </Typography>
            </Stack>
            <TextField
              label="Сообщение в чат"
              placeholder="Напишите сообщение мастеру..."
              multiline
              minRows={isMobile ? 2.3 : 2}
              maxRows={isMobile ? 4 : 8}
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
                  ? "Сообщение готово к отправке. Ctrl+Enter для быстрой отправки."
                  : "Введите текст сообщения. Ctrl+Enter для быстрой отправки."
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<AttachFileIcon />}
                sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
              >
                Файл
                <input hidden type="file" onChange={(event) => onFileChange(event.target.files?.[0] || null)} />
              </Button>
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                {file ? file.name : "Файл не выбран"}
              </Typography>
              <Button
                variant="contained"
                onClick={onSend}
                endIcon={<SendIcon />}
                disabled={isSending || Boolean(fileError)}
                sx={{ alignSelf: { xs: "stretch", sm: "auto" }, minWidth: { sm: 132 } }}
              >
                {isSending ? "Отправка..." : "Отправить"}
              </Button>
            </Stack>
          </Stack>
        </Paper>
        {!isSplitClientLayout && ruDesktopInputPanel}
      </Stack>
    </Paper>
  );
}

