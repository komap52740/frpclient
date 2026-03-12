import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import VideoLibraryRoundedIcon from "@mui/icons-material/VideoLibraryRounded";
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";

import { chatApi } from "../../api/client";
import { normalizeRuText } from "../../utils/text";

dayjs.locale("ru");

const EMPTY_FORM = {
  id: 0,
  command: "",
  title: "",
  text: "",
};

function normalizeCommand(value) {
  const raw = (value || "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw.slice(1).toLowerCase() : raw.toLowerCase();
}

function isValidCommand(command) {
  if (!command) return false;
  if (command.length > 20) return false;
  return /^[a-zа-яё0-9_-]+$/i.test(command);
}

function extractApiError(err, fallback) {
  const statusCode = Number(err?.response?.status || 0);
  const statusFallback = (() => {
    if (statusCode === 400) return "Проверьте поля шаблона и попробуйте снова.";
    if (statusCode === 401) return "Сессия истекла. Обновите страницу и войдите снова.";
    if (statusCode === 403) return "Недостаточно прав. Быстрые ответы доступны только мастеру.";
    if (statusCode === 404) return "Сервис шаблонов не найден. Обновите страницу.";
    if (statusCode === 409) return "Такой шаблон уже существует.";
    if (statusCode === 413) return "Файл слишком большой. Для фото/видео шаблона максимум 100 МБ.";
    if (statusCode === 415) return "Недопустимый формат файла. Загрузите фото или видео.";
    if (statusCode >= 500) return "Сервер временно недоступен. Повторите через 5-10 секунд.";
    return fallback;
  })();
  const data = err?.response?.data;
  if (!data) return statusFallback;

  if (typeof data === "string") {
    const trimmed = data.trim();
    const looksLikeHtml =
      trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<");
    if (looksLikeHtml) {
      return statusFallback;
    }
    return normalizeRuText(trimmed || statusFallback);
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return normalizeRuText(data.detail);
  }
  if (typeof data.non_field_errors?.[0] === "string") {
    return normalizeRuText(data.non_field_errors[0]);
  }

  const collectStrings = (value, acc = []) => {
    if (!value) return acc;
    if (typeof value === "string") {
      if (value.trim()) acc.push(value.trim());
      return acc;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collectStrings(item, acc));
      return acc;
    }
    if (typeof value === "object") {
      Object.values(value).forEach((item) => collectStrings(item, acc));
      return acc;
    }
    return acc;
  };

  const fieldOrder = ["command", "title", "text", "media_file", "remove_media"];
  for (const field of fieldOrder) {
    const values = collectStrings(data[field]);
    if (values.length) return normalizeRuText(values[0]);
  }

  const allValues = collectStrings(data);
  if (allValues.length) {
    const [firstValue] = allValues;
    return normalizeRuText(firstValue);
  }

  return statusFallback;
}

function inferMediaKind(fileName = "") {
  const name = String(fileName || "").toLowerCase();
  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  )
    return "image";
  if (
    name.endsWith(".mp4") ||
    name.endsWith(".mov") ||
    name.endsWith(".webm") ||
    name.endsWith(".m4v")
  )
    return "video";
  return "file";
}

export default function MasterQuickRepliesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [mediaFile, setMediaFile] = useState(null);
  const [removeMedia, setRemoveMedia] = useState(false);

  const activeEditItem = useMemo(
    () => items.find((item) => item.id === form.id) || null,
    [items, form.id]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chatApi.listQuickReplies();
      setItems(response.data || []);
      setError("");
    } catch {
      setError("Не удалось загрузить быстрые ответы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setMediaFile(null);
    setRemoveMedia(false);
  };

  const startEdit = (item) => {
    setForm({
      id: item.id,
      command: `/${item.command}`,
      title: item.title || "",
      text: item.text || "",
    });
    setMediaFile(null);
    setRemoveMedia(false);
    setError("");
    setSuccess("");
  };

  const onSave = async () => {
    const normalizedCommand = normalizeCommand(form.command);
    const normalizedText = (form.text || "").trim();
    if (!normalizedCommand) {
      setError("Укажите команду, например /1");
      return;
    }
    if (!isValidCommand(normalizedCommand)) {
      setError("Команда: только буквы, цифры, _, - (до 20 символов).");
      return;
    }
    if (items.some((item) => item.command === normalizedCommand && item.id !== form.id)) {
      setError(`Команда /${normalizedCommand} уже существует.`);
      return;
    }
    if (!normalizedText && !mediaFile && !(activeEditItem?.media_url && !removeMedia)) {
      setError("Добавьте текст или фото/видео");
      return;
    }
    const normalizedTitle = (form.title || "").trim();
    const shouldUseMultipart = Boolean(mediaFile || removeMedia);
    const payload = shouldUseMultipart
      ? (() => {
          const fd = new FormData();
          fd.append("command", normalizedCommand);
          fd.append("title", normalizedTitle);
          fd.append("text", normalizedText);
          if (mediaFile) {
            fd.append("media_file", mediaFile);
          } else if (removeMedia) {
            fd.append("remove_media", "true");
          }
          return fd;
        })()
      : {
          command: normalizedCommand,
          title: normalizedTitle,
          text: normalizedText,
        };

    try {
      setSaving(true);
      if (form.id) {
        await chatApi.updateQuickReply(form.id, payload);
      } else {
        await chatApi.createQuickReply(payload);
      }
      await load();
      resetForm();
      setSuccess("Шаблон сохранен");
      setError("");
    } catch (err) {
      setError(extractApiError(err, "Не удалось сохранить шаблон"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    try {
      setSaving(true);
      await chatApi.deleteQuickReply(id);
      await load();
      if (form.id === id) {
        resetForm();
      }
      setSuccess("Шаблон удален");
    } catch (err) {
      setError(extractApiError(err, "Не удалось удалить шаблон"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, md: 2.4 } }}>
        <Stack spacing={0.45}>
          <Typography variant="h5">Быстрые ответы мастера</Typography>
          <Typography variant="body2" color="text.secondary">
            Создавайте команды вида <b>/1</b>, <b>/оплата</b>. Можно прикреплять фото или видео к
            шаблону.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Использование в чате: отправьте <b>/команда</b> и шаблон подставится автоматически.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.4 } }}>
        <Stack spacing={1.2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <TextField
              label="Команда"
              placeholder="/1"
              value={form.command}
              onChange={(event) => setForm((prev) => ({ ...prev, command: event.target.value }))}
              sx={{ minWidth: { xs: "100%", md: 180 } }}
            />
            <TextField
              label="Название (опционально)"
              placeholder="Инструкция по подключению"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              sx={{ flexGrow: 1 }}
            />
          </Stack>

          <TextField
            label="Текст шаблона"
            multiline
            minRows={3}
            value={form.text}
            onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
            helperText="Можно оставить пустым, если будет только фото/видео"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button component="label" variant="outlined" startIcon={<AddRoundedIcon />}>
              {mediaFile ? "Заменить медиа" : "Добавить фото/видео"}
              <input
                hidden
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.m4v"
                onChange={(event) => {
                  setMediaFile(event.target.files?.[0] || null);
                  if (event.target.files?.[0]) {
                    setRemoveMedia(false);
                  }
                }}
              />
            </Button>

            {mediaFile ? (
              <Chip
                color="primary"
                variant="outlined"
                icon={
                  inferMediaKind(mediaFile.name) === "video" ? (
                    <VideoLibraryRoundedIcon />
                  ) : (
                    <ImageRoundedIcon />
                  )
                }
                label={mediaFile.name}
              />
            ) : null}

            {activeEditItem?.media_url && !mediaFile ? (
              <Chip
                variant={removeMedia ? "filled" : "outlined"}
                color={removeMedia ? "warning" : "default"}
                icon={
                  activeEditItem.media_kind === "video" ? (
                    <VideoLibraryRoundedIcon />
                  ) : (
                    <ImageRoundedIcon />
                  )
                }
                label={removeMedia ? "Медиа будет удалено" : "Медиа прикреплено"}
                onClick={() => setRemoveMedia((prev) => !prev)}
              />
            ) : null}
          </Stack>

          {activeEditItem?.media_url && !removeMedia ? (
            <Box>
              {activeEditItem.media_kind === "video" ? (
                <Box
                  component="video"
                  src={activeEditItem.media_url}
                  controls
                  sx={{
                    width: "100%",
                    maxHeight: 280,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              ) : (
                <Box
                  component="img"
                  src={activeEditItem.media_url}
                  alt="media"
                  sx={{
                    width: "100%",
                    maxHeight: 280,
                    objectFit: "cover",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              )}
            </Box>
          ) : null}

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={form.id ? <SaveRoundedIcon /> : <AddRoundedIcon />}
              onClick={onSave}
              disabled={saving}
            >
              {form.id ? "Сохранить" : "Добавить"}
            </Button>
            {form.id ? (
              <Button variant="outlined" onClick={resetForm} disabled={saving}>
                Новый шаблон
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.4 } }}>
        <Stack spacing={1.1}>
          <Typography variant="h6">Мои шаблоны</Typography>
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Загружаем...
            </Typography>
          ) : items.length ? (
            items.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 1.2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      /{item.command} {item.title ? `— ${item.title}` : ""}
                    </Typography>
                    {item.text ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {item.text}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Только медиа
                      </Typography>
                    )}
                    <Stack
                      direction="row"
                      spacing={0.7}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {item.media_url ? (
                        <Chip
                          size="small"
                          icon={
                            item.media_kind === "video" ? (
                              <VideoLibraryRoundedIcon />
                            ) : (
                              <ImageRoundedIcon />
                            )
                          }
                          label={item.media_kind === "video" ? "Видео" : "Фото"}
                          variant="outlined"
                        />
                      ) : null}
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(item.updated_at).format("DD.MM.YYYY HH:mm")}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={0.4}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => startEdit(item)}
                    >
                      Изменить
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={() => onDelete(item.id)}
                    >
                      Удалить
                    </Button>
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
      </Paper>
    </Stack>
  );
}
