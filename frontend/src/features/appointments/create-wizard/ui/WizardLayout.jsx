import { Alert, Box, Button, Paper, Stack } from "@mui/material";

export default function WizardLayout({
  error,
  children,
  canGoBack,
  canGoNext,
  currentStep,
  totalSteps,
  isSubmitting,
  onBack,
  onNext,
  onSubmit,
}) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Stack spacing={1.6}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper sx={{ p: { xs: 1.8, md: 2.2 }, borderRadius: 1.6 }}>{children}</Paper>

      <Box
        sx={{
          position: { xs: "sticky", md: "static" },
          bottom: { xs: 8, md: "auto" },
          zIndex: 2,
        }}
      >
        <Paper
          sx={{
            p: 1,
            borderRadius: 1.6,
            border: "1px solid",
            borderColor: "divider",
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack
            direction={{ xs: "column-reverse", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
          >
            <Button
              variant="text"
              disabled={!canGoBack || isSubmitting}
              onClick={onBack}
              data-testid="appointment-wizard-back"
            >
              Назад
            </Button>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {!isLastStep ? (
                <Button
                  variant="contained"
                  disabled={!canGoNext || isSubmitting}
                  onClick={onNext}
                  data-testid="appointment-wizard-next"
                >
                  Дальше
                </Button>
              ) : (
                <Button
                  variant="contained"
                  disabled={isSubmitting}
                  onClick={onSubmit}
                  data-testid="appointment-wizard-submit"
                >
                  {isSubmitting ? "Создаем заявку..." : "Создать заявку"}
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
