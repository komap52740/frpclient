import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Box, LinearProgress, Stack, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

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
    <Stack spacing={compact ? 0.7 : 1.05} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ minWidth: 0 }}
      >
        <Typography
          variant={compact ? "caption" : "body2"}
          sx={{ fontWeight: 760, color: ui.color, lineHeight: 1.2, minWidth: 0 }}
        >
          {ui.stepLabel}
        </Typography>
        {isTerminalError || slaBreached ? (
          <ErrorOutlineRoundedIcon fontSize="small" sx={{ color: ui.color }} />
        ) : null}
      </Stack>

      {compact ? (
        <Box sx={{ overflow: "hidden", borderRadius: 999 }}>
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
                transition: "none",
              },
            }}
          />
        </Box>
      ) : (
        <Box sx={{ width: "100%", minWidth: 0, overflowX: "clip" }}>
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            sx={{
              width: "100%",
              minWidth: 0,
              "& .MuiStep-root": {
                px: { xs: 0.15, sm: 0.35 },
                minWidth: 0,
              },
              "& .MuiStepLabel-labelContainer": {
                minWidth: 0,
              },
              "& .MuiStepLabel-label": {
                fontSize: 12,
                fontWeight: 650,
                color: "text.secondary",
                mt: 0.4,
                lineHeight: 1.15,
                whiteSpace: "normal",
              },
              "& .MuiStepLabel-label.Mui-active": {
                color: ui.color,
                fontWeight: 800,
              },
              "& .MuiStepLabel-label.Mui-completed": {
                color: "text.primary",
                fontWeight: 760,
              },
              "& .MuiStepIcon-root": {
                color: alpha(ui.color, 0.24),
              },
              "& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed": {
                color: ui.color,
              },
              "& .MuiStepConnector-line": {
                borderColor: alpha("#7ba8e8", 0.36),
              },
            }}
          >
            {STATUS_PROGRESS_ORDER.map((stepStatus) => (
              <Step
                key={stepStatus}
                completed={activeStep > (STEP_INDEX_MAP[stepStatus] ?? 0) || status === "COMPLETED"}
              >
                <StepLabel>{STEP_TITLES[stepStatus]}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {!compact ? (
        <Typography variant="caption" color="text.secondary" sx={{ minHeight: 18 }}>
          {ui.hint ||
            (role === "master"
              ? "Если шаг завис, уточните детали у клиента в чате."
              : "Если не получается — напишите мастеру в чат.")}
        </Typography>
      ) : null}
    </Stack>
  );
}
