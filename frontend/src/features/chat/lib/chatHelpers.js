import dayjs from "dayjs";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "pdf",
  "txt",
  "log",
  "zip",
  "webp",
  "mp4",
  "mov",
  "webm",
  "m4v",
];
const URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi;
const LINK_SOURCE_ROLES = new Set(["master", "admin"]);

export function mapSystemEvents(systemEvents = []) {
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

export function validateAttachment(file) {
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
  return String(rawUrl || "")
    .trim()
    .replace(/[),.;!?]+$/g, "");
}

function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(URL_REGEX) || [];
  return matches.map(normalizeUrl).filter(Boolean);
}

export function buildLinkItems(messages = []) {
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

export function shouldPlayIncomingMessageSound(message, currentUser) {
  if (!message || message.sender === currentUser?.id) return false;

  const currentRole = String(currentUser?.role || "").toLowerCase();
  const senderRole = String(message.sender_role || "").toLowerCase();
  if (currentRole === "client") {
    return senderRole === "master" || senderRole === "admin";
  }

  return true;
}
