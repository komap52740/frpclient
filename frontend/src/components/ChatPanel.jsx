import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
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
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "txt", "log", "zip"];
const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi;

const QUICK_TEMPLATES = {
  client: [
    "Р Р‡ Р Р…Р В° Р СР ВµРЎРѓРЎвЂљР Вµ, Р С–Р С•РЎвЂљР С•Р Р† Р С” Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘РЎР‹.",
    "Р С›Р С—Р В»Р В°РЎвЂљРЎС“ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘Р В», Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р С—Р С•Р В¶Р В°Р В»РЎС“Р в„–РЎРѓРЎвЂљР В°.",
    "Р СњР Вµ Р С—Р С•Р В»РЎС“РЎвЂЎР В°Р ВµРЎвЂљРЎРѓРЎРЏ, Р Р…РЎС“Р В¶Р Р…Р В° Р С—Р С•Р СР С•РЎвЂ°РЎРЉ Р С—Р С•РЎв‚¬Р В°Р С–Р С•Р Р†Р С•.",
  ],
  master: [
    "Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚Р С‘Р В» Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ, РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р В°РЎР‹ РЎР‚Р В°Р В±Р С•РЎвЂљРЎС“.",
    "Р СњРЎС“Р В¶Р ВµР Р… Р С”Р С•РЎР‚Р С•РЎвЂљР С”Р С‘Р в„– Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С” Р СџР С™ Р Т‘Р В»РЎРЏ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С–Р С• РЎв‚¬Р В°Р С–Р В°.",
    "Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ РЎР‚Р ВµР В·РЎС“Р В»РЎРЉРЎвЂљР В°РЎвЂљ Р С‘ Р Т‘Р В°Р в„–РЎвЂљР Вµ Р С•Р В±РЎР‚Р В°РЎвЂљР Р…РЎС“РЎР‹ РЎРѓР Р†РЎРЏР В·РЎРЉ.",
  ],
  admin: ["Р СџР С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР С‘Р В»Р С‘ Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”РЎС“, РЎРѓР ВµР в„–РЎвЂЎР В°РЎРѓ Р С—Р С•Р СР С•Р В¶Р ВµР С РЎР‚Р ВµРЎв‚¬Р С‘РЎвЂљРЎРЉ Р Р†Р С•Р С—РЎР‚Р С•РЎРѓ."],
};

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
      text: event.title || event.event_type || "Р РЋР С‘РЎРѓРЎвЂљР ВµР СР Р…Р С•Р Вµ РЎРѓР С•Р В±РЎвЂ№РЎвЂљР С‘Р Вµ",
    }));
}

function validateAttachment(file) {
  if (!file) return "";

  const extension = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return "Р В¤Р В°Р в„–Р В» Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р В±РЎвЂ№РЎвЂљРЎРЉ Р Р† РЎвЂћР С•РЎР‚Р СР В°РЎвЂљР Вµ jpg/jpeg/png/pdf/txt/log/zip";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Р В Р В°Р В·Р СР ВµРЎР‚ РЎвЂћР В°Р в„–Р В»Р В° Р Р…Р Вµ Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р С—РЎР‚Р ВµР Р†РЎвЂ№РЎв‚¬Р В°РЎвЂљРЎРЉ 10 Р СљР вЂ";
  }
  return "";
}

function normalizeCommand(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw.slice(1).toLowerCase() : raw.toLowerCase();
}

function splitCommandText(rawText) {
  const text = (rawText || "").trim();
  if (!text.startsWith("/") || text.startsWith("//")) return null;

  const firstToken = text.split(" ")[0];
  const command = normalizeCommand(firstToken);
  if (!command) return null;

  return { command, tail: text.slice(firstToken.length).trim() };
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

    extractUrls(message.text).forEach((url, index) => {
      const key = `${message.id}-${url}-${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        id: key,
        url,
        sender_username: message.sender_username || "Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ",
        created_at: message.created_at,
        message_text: message.text || "",
      });
    });
  });

  return items.sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
}

const EMPTY_REPLY_FORM = {
  id: 0,
  command: "",
  title: "",
  text: "",
};

export default function ChatPanel({
  appointmentId,
  currentUser,
  systemEvents = [],
  initialView = "messages",
  minimalClient = false,
  downloadLinks = [],
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
  const [quickPhrasesOpen, setQuickPhrasesOpen] = useState(!isMobile);

  const [quickReplies, setQuickReplies] = useState([]);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickReplyError, setQuickReplyError] = useState("");
  const [quickReplySaving, setQuickReplySaving] = useState(false);
  const [replyForm, setReplyForm] = useState(EMPTY_REPLY_FORM);

  const threadRef = useRef(null);

  const isMaster = currentUser.role === "master";
  const isMinimalClientMode = minimalClient && currentUser.role === "client";
  const isSplitClientLayout = false;
  const safeDownloadLinks = useMemo(
    () => (downloadLinks || []).filter((item) => item?.href && item?.label),
    [downloadLinks]
  );
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

          setMessages((prev) => {
            const merged = [...prev.filter((item) => !item.is_pending), ...response.data];
            const dedup = new Map();
            merged.forEach((message) => dedup.set(String(message.id), message));
            return Array.from(dedup.values()).sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
          });

          if (afterId === 0 || shouldStickToBottom) {
            setNewIncomingCount(0);
            window.requestAnimationFrame(scrollToBottom);
          } else if (hasForeignMessages) {
            setNewIncomingCount((prev) => prev + response.data.filter((item) => item.sender !== currentUser.id).length);
          }
        }
      } catch {
        setError("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘РЎРЏ");
      }
    },
    [appointmentId, currentUser.id, isNearBottom, scrollToBottom]
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
      setQuickReplyError("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ Р В±РЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р Вµ Р С•РЎвЂљР Р†Р ВµРЎвЂљРЎвЂ№.");
    }
  }, [isMaster]);

  useEffect(() => {
    setMessages([]);
    setNewIncomingCount(0);
    setChatView(initialView === "links" ? "links" : "messages");
    loadMessages(0);
  }, [appointmentId, initialView, loadMessages]);

  useEffect(() => {
    setChatView(initialView === "links" ? "links" : "messages");
  }, [initialView]);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  useEffect(() => {
    setQuickPhrasesOpen(isMinimalClientMode ? false : !isMobile);
  }, [appointmentId, isMobile, isMinimalClientMode]);

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

  const resolveQuickReplyText = useCallback(
    (rawText) => {
      const normalized = (rawText || "").trim();
      if (!isMaster || !normalized) return normalized;
      if (normalized.startsWith("//")) return normalized.slice(1);

      const parsed = splitCommandText(normalized);
      if (!parsed) return normalized;

      const matched = quickReplyMap.get(parsed.command);
      if (!matched) return normalized;

      return parsed.tail ? `${matched.text}\n\n${parsed.tail}` : matched.text;
    },
    [isMaster, quickReplyMap]
  );

  const onSend = async () => {
    const rawText = text.trim();
    if (!rawText && !file) return;

    const attachmentError = validateAttachment(file);
    setFileError(attachmentError);
    if (attachmentError) return;

    const resolvedText = resolveQuickReplyText(rawText);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender: currentUser.id,
      sender_username: currentUser.username || "Р вЂ™РЎвЂ№",
      text: resolvedText,
      file_url: null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      is_pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const formData = new FormData();
    if (resolvedText) formData.append("text", resolvedText);
    if (file) formData.append("file", file);

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
      setError(sendError?.response?.data?.detail || "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ");
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
      setError("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ");
    }
  };

  const applyTemplate = (templateText) => {
    setText((prev) => (!prev.trim() ? templateText : `${prev.trim()} ${templateText}`));
  };

  const applyQuickReplyCommand = (command) => {
    setText(`/${command}`);
  };

  const onFileChange = (nextFile) => {
    setFile(nextFile);
    setFileError(validateAttachment(nextFile));
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError("Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С”Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“");
    }
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
      setQuickReplyError("Р вЂ”Р В°Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР Вµ Р С”Р С•Р СР В°Р Р…Р Т‘РЎС“ Р С‘ РЎвЂљР ВµР С”РЎРѓРЎвЂљ РЎв‚¬Р В°Р В±Р В»Р С•Р Р…Р В°.");
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
      setQuickReplyError(err?.response?.data?.detail || "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ Р В±РЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р в„– Р С•РЎвЂљР Р†Р ВµРЎвЂљ.");
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
      setQuickReplyError(err?.response?.data?.detail || "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎС“Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ Р В±РЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р в„– Р С•РЎвЂљР Р†Р ВµРЎвЂљ.");
    } finally {
      setQuickReplySaving(false);
    }
  };

  const linksPanel = (
    <Paper
      variant="outlined"
      sx={{
        p: 1.1,
        borderRadius: 2.5,
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
                borderRadius: 2.2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: isDark ? alpha("#111b2f", 0.8) : "#ffffff",
              }}
            >
              <Stack spacing={0.45}>
                <Typography variant="caption" color="text.secondary">
                  {item.sender_username} РІР‚Сћ {dayjs(item.created_at).format("DD.MM.YYYY HH:mm")}
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
                    Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                    onClick={() => copyLink(item.url)}
                  >
                    Р С™Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Р РЋРЎРѓРЎвЂ№Р В»Р С•Р С” Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ. Р С›РЎвЂљР С—РЎР‚Р В°Р Р†РЎРЉРЎвЂљР Вµ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ РЎРѓ `https://...`, Р С‘ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° Р С—Р С•РЎРЏР Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р В·Р Т‘Р ВµРЎРѓРЎРЉ Р В°Р Р†РЎвЂљР С•Р СР В°РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р С‘.
        </Typography>
      )}
    </Paper>
  );

  return (
    <Paper
      sx={{
        p: { xs: 1.4, sm: 2.1 },
        borderRadius: 3.2,
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
            label={`РЎСЃС‹Р»РєРё: ${linkItems.length}`}
            variant="outlined"
          />
        </Stack>

        {!isSplitClientLayout && !isMinimalClientMode ? (
          <Tabs
            value={chatView}
            onChange={(_, value) => setChatView(value)}
            variant="fullWidth"
            sx={{
              borderRadius: 2.4,
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
            <Tab value="messages" label="РЎРѕРѕР±С‰РµРЅРёСЏ" />
            <Tab value="links" label={`РЎСЃС‹Р»РєРё (${linkItems.length})`} />
          </Tabs>
        ) : null}

        {!isMinimalClientMode ? (
          <Stack spacing={0.65}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {isMaster ? "Р вЂРЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р Вµ РЎвЂћРЎР‚Р В°Р В·РЎвЂ№ Р С‘ Р С”Р С•Р СР В°Р Р…Р Т‘РЎвЂ№" : "Р вЂРЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р Вµ РЎвЂћРЎР‚Р В°Р В·РЎвЂ№"}
              </Typography>
              <Button
                size="small"
                variant="text"
                endIcon={quickPhrasesOpen ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                onClick={() => setQuickPhrasesOpen((prev) => !prev)}
                sx={{ minHeight: 28, px: 1 }}
              >
                {quickPhrasesOpen ? "Р РЋР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ" : "Р СџР С•Р С”Р В°Р В·Р В°РЎвЂљРЎРЉ"}
              </Button>
            </Stack>
            {quickPhrasesOpen ? (
              <Stack
                direction="row"
                spacing={0.7}
                flexWrap={isMobile ? "nowrap" : "wrap"}
                useFlexGap={!isMobile}
                sx={{ overflowX: isMobile ? "auto" : "visible", pb: isMobile ? 0.4 : 0 }}
              >
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
                        label={item.title ? `/${item.command} РІР‚вЂќ ${item.title}` : `/${item.command}`}
                        color="primary"
                        variant="outlined"
                        onClick={() => applyQuickReplyCommand(item.command)}
                        sx={{ cursor: "pointer" }}
                      />
                    ))
                  : null}
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {isMaster ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Р С™Р С•Р СР В°Р Р…Р Т‘РЎвЂ№ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°: Р Р†Р Р†Р ВµР Т‘Р С‘РЎвЂљР Вµ `/Р С”Р С•Р СР В°Р Р…Р Т‘Р В°`, Р Р…Р В°Р С—РЎР‚Р С‘Р СР ВµРЎР‚ `/1`.
            </Typography>
            <Button
              size="small"
              startIcon={<SettingsRoundedIcon fontSize="small" />}
              onClick={() => setQuickRepliesOpen(true)}
            >
              Р Р€Р С—РЎР‚Р В°Р Р†Р В»РЎРЏРЎвЂљРЎРЉ
            </Button>
          </Stack>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
        {fileError ? <Alert severity="warning">{fileError}</Alert> : null}
        {file && !fileError ? <Alert severity="success">Р В¤Р В°Р в„–Р В» Р С–Р С•РЎвЂљР С•Р Р† Р С” Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р Вµ: {file.name}</Alert> : null}

        {isSplitClientLayout ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, 0.85fr)",
              gap: 1,
              alignItems: "start",
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 0.8,
                borderRadius: 2.5,
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
                containerRef={threadRef}
                onScroll={onThreadScroll}
              />
            </Paper>
            <Stack spacing={0.6}>
              {safeDownloadLinks.length ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderRadius: 2.5,
                    borderColor: "divider",
                    bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
                  }}
                >
                  <Stack spacing={0.55}>
                    <Typography variant="caption" color="text.secondary">
                      Р РЋР С”Р В°РЎвЂЎР В°РЎвЂљРЎРЉ Р С‘ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ
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
                        sx={{ justifyContent: "flex-start", borderRadius: 2 }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              ) : null}
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.2 }}>
                Р РЋРЎРѓРЎвЂ№Р В»Р С”Р С‘ Р С‘Р В· РЎвЂЎР В°РЎвЂљР В°
              </Typography>
              {linksPanel}
            </Stack>
          </Box>
        ) : isMinimalClientMode || chatView === "messages" ? (
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
            borderRadius: 2.5,
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
            <TextField
              label="РЎРѕРѕР±С‰РµРЅРёРµ"
              placeholder=""
              multiline
              minRows={isMobile ? 2.3 : 2}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  onSend();
                }
              }}
              helperText={isMinimalClientMode ? "Пишите коротко и по делу. Ctrl+Enter для отправки." : "Ctrl+Enter для быстрой отправки."}
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
        </Paper>
      </Stack>

      <Dialog open={quickRepliesOpen} onClose={() => setQuickRepliesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Р вЂРЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р Вµ Р С•РЎвЂљР Р†Р ВµРЎвЂљРЎвЂ№ Р СР В°РЎРѓРЎвЂљР ВµРЎР‚Р В°</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Typography variant="body2" color="text.secondary">
              Р РЋР С•Р В·Р Т‘Р В°Р в„–РЎвЂљР Вµ РЎРѓР Р†Р С•Р С‘ Р С”Р С•Р СР В°Р Р…Р Т‘РЎвЂ№ Р С‘ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Р С‘РЎвЂ¦ Р Р† РЎвЂЎР В°РЎвЂљР Вµ: `/1`, `/Р С—РЎР‚Р С‘Р Р†Р ВµРЎвЂљ` Р С‘ РЎвЂљ.Р Т‘.
            </Typography>

            {quickReplyError ? <Alert severity="error">{quickReplyError}</Alert> : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Р С™Р С•Р СР В°Р Р…Р Т‘Р В°"
                placeholder="/1"
                value={replyForm.command}
                onChange={(event) => setReplyForm((prev) => ({ ...prev, command: event.target.value }))}
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              />
              <TextField
                label="Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ (Р С•Р С—РЎвЂ Р С‘Р С•Р Р…Р В°Р В»РЎРЉР Р…Р С•)"
                placeholder="Р ВР Р…РЎРѓРЎвЂљРЎР‚РЎС“Р С”РЎвЂ Р С‘РЎРЏ Р С—Р С• РЎС“РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С”Р Вµ"
                value={replyForm.title}
                onChange={(event) => setReplyForm((prev) => ({ ...prev, title: event.target.value }))}
                sx={{ flexGrow: 1 }}
              />
            </Stack>

            <TextField
              label="Р СћР ВµР С”РЎРѓРЎвЂљ РЎв‚¬Р В°Р В±Р В»Р С•Р Р…Р В°"
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
                {replyForm.id ? "Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ" : "Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ"}
              </Button>
              {replyForm.id ? (
                <Button variant="outlined" onClick={resetReplyForm} disabled={quickReplySaving}>
                  Р СњР С•Р Р†РЎвЂ№Р в„– РЎв‚¬Р В°Р В±Р В»Р С•Р Р…
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
                          /{item.command} {item.title ? `РІР‚вЂќ ${item.title}` : ""}
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
                  Р РЃР В°Р В±Р В»Р С•Р Р…Р С•Р Р† Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ. Р вЂќР С•Р В±Р В°Р Р†РЎРЉРЎвЂљР Вµ Р С—Р ВµРЎР‚Р Р†РЎвЂ№Р в„– Р В±РЎвЂ№РЎРѓРЎвЂљРЎР‚РЎвЂ№Р в„– Р С•РЎвЂљР Р†Р ВµРЎвЂљ.
                </Typography>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickRepliesOpen(false)}>Р вЂ”Р В°Р С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
