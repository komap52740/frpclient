import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";

export default function ChatComposer({
  isDark,
  isMobile,
  text,
  file,
  fileError,
  isSending,
  setText,
  onFileChange,
  onSend,
}) {
  return (
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
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
              event.preventDefault();
              onSend();
            }
          }}
          helperText={
            text.trim().length
              ? "Сообщение готово к отправке. Enter — отправить, Shift+Enter — новая строка."
              : "Введите текст сообщения. Enter — отправить, Shift+Enter — новая строка."
          }
          slotProps={{ htmlInput: { "data-testid": "chat-composer-text" } }}
        />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Button
            component="label"
            variant="outlined"
            startIcon={<AttachFileIcon />}
            sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
          >
            Файл
            <input
              hidden
              type="file"
              data-testid="chat-composer-file-input"
              onChange={(event) => onFileChange(event.target.files?.[0] || null)}
            />
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
            data-testid="chat-composer-send"
          >
            {isSending ? "Отправка..." : "Отправить"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
