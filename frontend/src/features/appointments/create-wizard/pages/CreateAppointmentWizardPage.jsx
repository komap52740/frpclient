import { Stack } from "@mui/material";

import { useAppointmentWizardForm } from "../model/useAppointmentWizardForm";
import AccessStep from "../ui/steps/AccessStep";
import DeviceStep from "../ui/steps/DeviceStep";
import ReviewSubmitStep from "../ui/steps/ReviewSubmitStep";
import WizardLayout from "../ui/WizardLayout";
import WizardProgress from "../ui/WizardProgress";

export default function CreateAppointmentWizardPage() {
  const wizard = useAppointmentWizardForm();

  const stepContent = [
    <DeviceStep
      key="device"
      form={wizard.form}
      errors={wizard.errors}
      touched={wizard.touched}
      updateField={wizard.updateField}
      markTouched={wizard.markTouched}
    />,
    <AccessStep
      key="access"
      form={wizard.form}
      errors={wizard.errors}
      touched={wizard.touched}
      updateField={wizard.updateField}
      markTouched={wizard.markTouched}
      hasStoredAccess={wizard.hasStoredAccess}
      draftMeta={wizard.draftMeta}
      ruInputsUnlocked={wizard.ruInputsUnlocked}
      unlockRuInputs={wizard.unlockRuInputs}
    />,
    <ReviewSubmitStep key="review" form={wizard.form} timingEstimate={wizard.timingEstimate} />,
  ];

  return (
    <Stack spacing={1.6} data-testid="appointment-wizard-page">
      <WizardProgress currentStep={wizard.currentStep} steps={wizard.steps} />

      <WizardLayout
        error={wizard.error}
        canGoBack={wizard.canGoBack}
        canGoNext={wizard.canGoNext}
        currentStep={wizard.currentStep}
        totalSteps={wizard.steps.length}
        isSubmitting={wizard.isSubmitting}
        onBack={wizard.prevStep}
        onNext={wizard.nextStep}
        onSubmit={wizard.submit}
      >
        {stepContent[wizard.currentStep]}
      </WizardLayout>
    </Stack>
  );
}
