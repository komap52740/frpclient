import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { Alert, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";

import { normalizeRuText } from "../../../../utils/text";

export function AppointmentTrustSidebar({
  appointment,
  clientProfilePath,
  completionEtaMinutes,
  formatEtaMinutes,
  navigate,
  responseEtaMinutes,
}) {
  return (
    <Paper sx={{ p: 2.2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ShieldRoundedIcon color="primary" fontSize="small" />
        <Typography variant="h3">Доверие и прозрачность</Typography>
      </Stack>

      <Stack spacing={0.7}>
        <Typography variant="body2">
          <b>Мастер:</b> {normalizeRuText(appointment.master_username) || "Пока не назначен"}
        </Typography>
        <Typography variant="body2">
          <b>Риск клиента:</b> {appointment.client_risk_level || "—"}{" "}
          {appointment.client_risk_score != null ? `(${appointment.client_risk_score})` : ""}
        </Typography>
        {clientProfilePath ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ShieldRoundedIcon fontSize="small" />}
            onClick={() => navigate(clientProfilePath)}
            sx={{ alignSelf: "flex-start" }}
          >
            Открыть полный профиль клиента
          </Button>
        ) : null}
        {appointment.is_wholesale_request ? (
          <Typography variant="body2">
            <b>Клиент:</b> B2B
          </Typography>
        ) : null}
        <Typography variant="body2">
          <b>SLA ответ до:</b>{" "}
          {appointment.response_deadline_at
            ? dayjs(appointment.response_deadline_at).format("DD.MM.YYYY HH:mm")
            : "—"}
        </Typography>
        <Typography variant="body2">
          <b>SLA завершение до:</b>{" "}
          {appointment.completion_deadline_at
            ? dayjs(appointment.completion_deadline_at).format("DD.MM.YYYY HH:mm")
            : "—"}
        </Typography>
        {["NEW", "IN_REVIEW"].includes(appointment.status) && responseEtaMinutes != null ? (
          <Alert severity={responseEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
            Ожидаем ответ мастера: {formatEtaMinutes(responseEtaMinutes)}
          </Alert>
        ) : null}
        {["PAID", "IN_PROGRESS"].includes(appointment.status) && completionEtaMinutes != null ? (
          <Alert severity={completionEtaMinutes <= 0 ? "warning" : "info"} sx={{ py: 0 }}>
            Прогноз до завершения: {formatEtaMinutes(completionEtaMinutes)}
          </Alert>
        ) : null}
        {appointment.sla_breached ? (
          <Alert severity="warning">SLA нарушен. Мы уже уведомили администратора.</Alert>
        ) : null}
        <Divider sx={{ my: 0.7 }} />
        <Typography variant="caption">
          Что делать дальше: ориентируйтесь на шаги сверху и используйте чат для всех уточнений.
        </Typography>
        <Typography variant="caption">Обычно назначение мастера занимает 5-15 минут.</Typography>
        <Typography variant="caption">
          Если не получается — напишите в чат, мы подключимся.
        </Typography>
      </Stack>
    </Paper>
  );
}

export function AppointmentLinksSidebar({
  canLaunchRuDesktop,
  handlePrimaryAction,
  hasRuDesktopCredentials,
  isClient,
  isMasterAssigned,
  openRuDesktopSession,
  requestClientPasswordCheck,
  rustdeskId,
  rustdeskPassword,
  setClientAccessDialogOpen,
  sidebarLinks,
  copyToClipboard,
  user,
}) {
  return (
    <Paper sx={{ p: 2.2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <LinkRoundedIcon color="primary" fontSize="small" />
        <Typography variant="h3">Ссылки и подключение</Typography>
      </Stack>
      <Stack spacing={0.9}>
        <Typography variant="caption" color="text.secondary">
          Все нужные ссылки собраны справа, чтобы не искать их в переписке.
        </Typography>

        {rustdeskId ? (
          <Stack spacing={0.8}>
            <Chip
              size="small"
              icon={<ComputerRoundedIcon fontSize="small" />}
              label={`Логин/ID RuDesktop: ${rustdeskId}`}
              sx={{ alignSelf: "flex-start" }}
            />
            {hasRuDesktopCredentials ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<ComputerRoundedIcon fontSize="small" />}
                onClick={() => openRuDesktopSession(rustdeskId, rustdeskPassword)}
                sx={{
                  alignSelf: "flex-start",
                  borderRadius: 2,
                  px: 1.8,
                  boxShadow: 0,
                  background: "linear-gradient(120deg, #1d4ed8 0%, #0ea5e9 100%)",
                  "&:hover": {
                    boxShadow: "0 10px 24px rgba(14,165,233,0.28)",
                  },
                }}
                disabled={!canLaunchRuDesktop}
              >
                Подключиться по кнопке
              </Button>
            ) : null}
            {canLaunchRuDesktop ? (
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label="1) Запуск RuDesktop" />
                <Chip size="small" variant="outlined" label="2) Вставьте пароль" />
              </Stack>
            ) : null}
            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                onClick={() => copyToClipboard(rustdeskId, "Логин/ID RuDesktop не указан")}
              >
                Копировать логин/ID
              </Button>
              {rustdeskPassword ? (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                  onClick={() => copyToClipboard(rustdeskPassword, "Пароль RuDesktop не указан")}
                  sx={{
                    borderRadius: 2,
                    boxShadow: 0,
                    background: "linear-gradient(120deg, #16a34a 0%, #22c55e 100%)",
                  }}
                >
                  Копировать пароль
                </Button>
              ) : null}
            </Stack>
            {hasRuDesktopCredentials ? (
              <Typography variant="caption" color="text.secondary">
                Кнопка запускает RuDesktop, а в буфер копируется только пароль.
              </Typography>
            ) : null}
            {isClient ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setClientAccessDialogOpen(true)}
                sx={{ alignSelf: "flex-start" }}
              >
                Обновить данные RuDesktop
              </Button>
            ) : null}
            {user.role === "master" && isMasterAssigned ? (
              <Button
                size="small"
                variant="outlined"
                onClick={requestClientPasswordCheck}
                sx={{ alignSelf: "flex-start" }}
              >
                Запросить проверку пароля
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Alert
            severity={isClient ? "info" : "warning"}
            action={
              isClient ? (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setClientAccessDialogOpen(true)}
                >
                  Добавить
                </Button>
              ) : (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => handlePrimaryAction("open_chat")}
                >
                  В чат
                </Button>
              )
            }
          >
            {isClient
              ? "Логин/ID RuDesktop пока не указан. Добавьте данные — это можно сделать в любой момент."
              : "Клиент еще не указал логин/ID RuDesktop. Запросите его в чате."}
          </Alert>
        )}

        {!isClient ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<LinkRoundedIcon fontSize="small" />}
            onClick={() => handlePrimaryAction("open_links")}
            sx={{ alignSelf: "flex-start" }}
          >
            Открыть чат-ссылки
          </Button>
        ) : null}

        <Stack spacing={0.6}>
          {sidebarLinks.map((item) => (
            <Button
              key={item.id}
              size="small"
              variant="outlined"
              component="a"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              startIcon={<OpenInNewRoundedIcon fontSize="small" />}
              sx={{ justifyContent: "flex-start" }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function AppointmentTimelineSidebar({ sidebarTimelineEvents, timelineRef, getEventTitle }) {
  return (
    <Paper ref={timelineRef} sx={{ p: 2.2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <TimelineRoundedIcon color="primary" fontSize="small" />
        <Typography variant="h3">Лента событий</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Обновляется автоматически
      </Typography>

      {sidebarTimelineEvents.length ? (
        <Stack spacing={1}>
          {sidebarTimelineEvents.map((event, index) => (
            <Stack key={event.id} spacing={0.35}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {getEventTitle(event)}
              </Typography>
              {event.note ? (
                <Typography variant="caption" color="text.secondary">
                  {normalizeRuText(event.note)}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                {normalizeRuText(event.actor_username) || "Система"} •{" "}
                {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
              </Typography>
              {index < sidebarTimelineEvents.length - 1 ? <Divider /> : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          События пока отсутствуют.
        </Typography>
      )}
    </Paper>
  );
}
