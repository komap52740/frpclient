import {
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

export default function WizardProgress({ currentStep, steps }) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Paper sx={{ p: { xs: 1.6, md: 2 }, borderRadius: 1.6 }}>
      <Stack spacing={1.2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Stack spacing={0.35}>
            <Typography variant="h5">Новая заявка</Typography>
            <Typography variant="body2" color="text.secondary">
              Собираем только то, что реально помогает мастеру быстрее взять заявку в работу.
            </Typography>
          </Stack>
          <Chip
            color="primary"
            variant="outlined"
            label={`Шаг ${currentStep + 1} из ${steps.length}`}
          />
        </Stack>

        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 8, borderRadius: 999 }}
        />

        <Stepper
          activeStep={currentStep}
          alternativeLabel
          sx={{ display: { xs: "none", md: "flex" } }}
        >
          {steps.map((step) => (
            <Step key={step.key}>
              <StepLabel>{step.title}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Stack spacing={0.35} sx={{ display: { xs: "flex", md: "none" } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {steps[currentStep].title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {steps[currentStep].description}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
