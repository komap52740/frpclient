import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Box, LinearProgress, Stack, Step, StepLabel, Stepper, Typography } from "@mui/material";

import { STATUS_PROGRESS_ORDER, resolveStatusUI } from "../../theme/status";

const STEP_TITLES = {
  NEW: "Новая",
  IN_REVIEW: "Проверка",
  AWAITING_PAYMENT: "Оплата",
  PAYMENT_PROOF_UPLOADED: "Проверка чека",
  PAID: "Подтверждено",
  IN_PROGRESS: "Работа",
  COMPLETED: "Готово",
};

const STEP_INDEX_MAP = {
  NEW: 0,
  IN_REVIEW: 1,
  AWAITING_PAYMENT: 2,
  PAYMENT_PROOF_UPLOADED: 3,
  PAID: 4,
  IN_PROGRESS: 5,
  COMPLETED: 6,
  DECLINED_BY_MASTER: 1,
  CANCELLED: 0,
};

function getProgressValue(status) {
  const maxIndex = STATUS_PROGRESS_ORDER.length - 1;
  const index = STEP_INDEX_MAP[status] ?? 0;
  return Math.round((index / maxIndex) * 100);
}

export default function StatusStepper({ status, role, compact = false, slaBreached = false }) {
  const ui = resolveStatusUI(status, slaBreached);
  const activeStep = STEP_INDEX_MAP[status] ?? 0;
  const isTerminalError = status === "DECLINED_BY_MASTER" || status === "CANCELLED";

  return (
    <Stack spacing={compact ? 0.75 : 1.25}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant={compact ? "caption" : "body2"} sx={{ fontWeight: 700, color: ui.color }}>
          {ui.stepLabel}
        </Typography>
        {isTerminalError || slaBreached ? <ErrorOutlineRoundedIcon fontSize="small" sx={{ color: ui.color }} /> : null}
      </Stack>

      {compact ? (
        <Box>
          <LinearProgress
            variant="determinate"
            value={getProgressValue(status)}
            sx={{
              height: 7,
              borderRadius: 999,
              bgcolor: ui.bg,
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
                bgcolor: ui.color,
              },
            }}
          />
        </Box>
      ) : (
        <Stepper activeStep={activeStep} alternativeLabel>
          {STATUS_PROGRESS_ORDER.map((stepStatus) => (
            <Step key={stepStatus} completed={activeStep > (STEP_INDEX_MAP[stepStatus] ?? 0) || status === "COMPLETED"}>
              <StepLabel>{STEP_TITLES[stepStatus]}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {!compact ? (
        <Typography variant="caption" color="text.secondary">
          {ui.hint || (role === "master" ? "Если не получается — напишите в чат клиента." : "Если не получается — напишите в чат мастеру.")}
        </Typography>
      ) : null}
    </Stack>
  );
}
