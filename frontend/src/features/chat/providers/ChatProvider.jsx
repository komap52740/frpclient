import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import dayjs from "dayjs";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "dayjs/locale/ru";

import { chatApi } from "../../../api/client";
import { useAppointmentMessagesQuery } from "../hooks/useAppointmentMessagesQuery";
import { useChatRealtime } from "../hooks/useChatRealtime";
import {
  buildLinkItems,
  mapSystemEvents,
  shouldPlayIncomingMessageSound,
  validateAttachment,
} from "../lib/chatHelpers";

dayjs.locale("ru");

export const ChatContext = createContext(null);

export function ChatProvider({
  appointmentId,
  currentUser,
  systemEvents = [],
  initialView = "messages",
  downloadLinks = [],
  ruDesktop = null,
  canEditRuDesktop = false,
  onSaveRuDesktop = null,
  ruDesktopSaving = false,
  children,
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

  const currentRole = String(currentUser?.role || "").toLowerCase();
  const isClientRole = currentRole === "client";
  const isSplitClientLayout = isClientRole && !isMobile;

  const safeDownloadLinks = useMemo(
    () => (downloadLinks || []).filter((item) => item?.href && item?.label),
    [downloadLinks]
  );
  const { error: messagesError, refetch: refetchMessages } =
    useAppointmentMessagesQuery(appointmentId);

  const lastMessageId = useMemo(
    () =>
      messages.reduce(
        (maxId, message) =>
          typeof message.id === "number" && message.id > maxId ? message.id : maxId,
        0
      ),
    [messages]
  );
  const threadItems = useMemo(() => {
    const messageItems = messages.map((message) => ({ ...message, type: "message" }));
    const eventItems = mapSystemEvents(systemEvents);
    return [...messageItems, ...eventItems].sort(
      (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf()
    );
  }, [messages, systemEvents]);
  const linkItems = useMemo(() => buildLinkItems(messages), [messages]);
  const hasRuDesktopCard = Boolean(
    ruDesktop?.id || ruDesktop?.password || ruDesktop?.downloadUrl || ruDesktop?.helpUrl
  );
  const ruDesktopId = String(ruDesktop?.id || "").trim();
  const ruDesktopPassword = String(ruDesktop?.password || "").trim();

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
      // Ignore browser audio restrictions.
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
      // Ignore browser audio restrictions.
    }
  }, []);

  const loadMessages = useCallback(
    async (afterId = 0) => {
      try {
        const result = await refetchMessages();
        const incomingMessages = Array.isArray(result.data) ? result.data : [];
        if (!incomingMessages.length) {
          return;
        }

        const shouldStickToBottom = isNearBottom();
        const newMessages =
          afterId > 0
            ? incomingMessages.filter((item) => typeof item.id === "number" && item.id > afterId)
            : incomingMessages;
        const hasForeignMessages = newMessages.some((item) => item.sender !== currentUser?.id);
        const hasIncomingMessagesForSound = newMessages.some((item) =>
          shouldPlayIncomingMessageSound(item, currentUser)
        );

        setMessages((prev) => {
          const merged = [...prev.filter((item) => item.is_pending), ...incomingMessages];
          const dedup = new Map();
          merged.forEach((message) => dedup.set(String(message.id), message));
          return Array.from(dedup.values()).sort(
            (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf()
          );
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
          setNewIncomingCount(
            (prev) => prev + newMessages.filter((item) => item.sender !== currentUser?.id).length
          );
        }
      } catch {
        setError("Не удалось загрузить сообщения");
      }
    },
    [currentUser, isNearBottom, playIncomingMessageSound, refetchMessages, scrollToBottom]
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
        // Ignore browser audio restrictions.
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
    if (messagesError) {
      setError("Не удалось загрузить сообщения");
    }
  }, [messagesError]);

  useEffect(() => {
    hasLoadedInitialBatchRef.current = false;
    setMessages([]);
    setNewIncomingCount(0);
    setChatView(initialView === "links" ? "links" : "messages");
    loadMessages(0);
  }, [appointmentId, initialView, loadMessages]);

  useEffect(() => {
    setChatView(initialView === "links" ? "links" : "messages");
  }, [initialView]);

  useChatRealtime({
    appointmentId,
    enabled: Boolean(appointmentId && currentUser?.id),
    onConnected: () => {
      loadMessages(lastMessageId || 0);
    },
    onChatEvent: (payload) => {
      if (payload?.kind !== "chat_event") {
        return;
      }

      const eventType = String(payload?.event?.event_type || "");
      if (eventType === "chat.message_deleted") {
        loadMessages(0);
        return;
      }
      if (eventType === "chat.message_sent") {
        loadMessages(lastMessageId || 0);
      }
    },
  });

  useEffect(() => {
    if (!lastMessageId) return;
    chatApi.read(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  useEffect(() => {
    setRuDesktopForm({
      rustdesk_id: ruDesktopId,
      rustdesk_password: ruDesktopPassword,
    });
  }, [ruDesktopId, ruDesktopPassword]);

  useEffect(
    () => () => {
      const audioCtx = sendAudioContextRef.current;
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => undefined);
      }
    },
    []
  );

  const onThreadScroll = useCallback(() => {
    if (isNearBottom()) {
      setNewIncomingCount(0);
    }
  }, [isNearBottom]);

  const onSend = async () => {
    const rawText = text.trim();
    if (!rawText && !file) return;

    const attachmentError = validateAttachment(file);
    setFileError(attachmentError);
    if (attachmentError) return;

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender: currentUser?.id,
      sender_username: currentUser?.username || "Вы",
      sender_role: currentUser?.role || "",
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
        return [...withoutOptimistic, response.data].sort(
          (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf()
        );
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

  const updateRuDesktopField = (field, value) => {
    setRuDesktopForm((prev) => ({ ...prev, [field]: value }));
    setRuDesktopError("");
    setRuDesktopSuccess("");
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

  const value = useMemo(
    () => ({
      appointmentId,
      currentUser,
      isMobile,
      isDark,
      isSplitClientLayout,
      text,
      file,
      error,
      fileError,
      isSending,
      chatView,
      newIncomingCount,
      ruDesktopForm,
      ruDesktopError,
      ruDesktopSuccess,
      threadRef,
      safeDownloadLinks,
      threadItems,
      linkItems,
      canEditRuDesktop,
      ruDesktopSaving,
      hasRuDesktopCard,
      ruDesktopId,
      ruDesktopPassword,
      setChatView,
      setText,
      setNewIncomingCount,
      updateRuDesktopField,
      onThreadScroll,
      onSend,
      onDelete,
      onFileChange,
      copyLink,
      scrollToBottom,
      saveRuDesktopInline,
    }),
    [
      appointmentId,
      canEditRuDesktop,
      chatView,
      copyLink,
      currentUser,
      error,
      file,
      fileError,
      hasRuDesktopCard,
      isDark,
      isMobile,
      isSending,
      isSplitClientLayout,
      linkItems,
      newIncomingCount,
      onDelete,
      onFileChange,
      onSend,
      onThreadScroll,
      ruDesktopError,
      ruDesktopForm,
      ruDesktopId,
      ruDesktopPassword,
      ruDesktopSaving,
      ruDesktopSuccess,
      safeDownloadLinks,
      saveRuDesktopInline,
      scrollToBottom,
      text,
      threadItems,
      updateRuDesktopField,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
