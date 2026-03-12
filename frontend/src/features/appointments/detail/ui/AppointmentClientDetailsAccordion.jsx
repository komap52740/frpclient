import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

import { normalizeRuText } from "../../../../utils/text";

export default function AppointmentClientDetailsAccordion({
  timelineRef,
  isDark,
  appointment,
  visibleTimelineEvents,
  getEventTitle,
}) {
  return (
    <Accordion
      ref={timelineRef}
      disableGutters
      sx={{
        borderRadius: 1.8,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: isDark ? "0 8px 24px rgba(2,6,23,0.45)" : "0 8px 24px rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Stack spacing={0.25}>
          <Typography variant="h3">Подробнее по заказу</Typography>
          <Typography variant="caption" color="text.secondary">
            Доверие, сроки и последние события
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.2}>
          <Typography variant="body2">
            <b>Мастер:</b> {normalizeRuText(appointment.master_username) || "Пока не назначен"}
          </Typography>
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
          {appointment.sla_breached ? (
            <Alert severity="warning" sx={{ py: 0 }}>
              Мы уже подключили администратора, чтобы ускорить процесс.
            </Alert>
          ) : null}
          <Divider />
          <Typography variant="subtitle2">Последние события</Typography>
          {visibleTimelineEvents.length ? (
            <Stack spacing={0.9}>
              {visibleTimelineEvents.slice(0, 6).map((event) => (
                <Stack key={event.id} spacing={0.25}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {getEventTitle(event)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(event.created_at).format("DD.MM.YYYY HH:mm")}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Событий пока нет.
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
