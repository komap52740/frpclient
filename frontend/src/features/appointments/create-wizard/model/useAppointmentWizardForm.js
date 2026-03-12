import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createAppointment } from "../api/createAppointmentApi";
import {
  clearCreateDraft,
  readCreateDefaults,
  readCreateDraft,
  writeCreateDefaults,
  writeCreateDraft,
} from "../lib/draftStorage";
import {
  WIZARD_STEPS,
  buildCreateAppointmentPayload,
  estimateAppointmentTiming,
  findFirstInvalidStep,
  getAppointmentWizardErrors,
  getEmptyAppointmentWizardForm,
  hasStepErrors,
} from "./schema";

function buildInitialForm(defaults, draft) {
  return {
    ...getEmptyAppointmentWizardForm(defaults),
    ...(draft.form || {}),
    photo_lock_screen: null,
  };
}

function buildInitialTouched(form) {
  return {
    brand: Boolean(form.brand),
    model: Boolean(form.model),
    has_pc: true,
    rustdesk_id: Boolean(form.rustdesk_id),
    rustdesk_password: Boolean(form.rustdesk_password),
    photo_lock_screen: false,
  };
}

function resolveCreateError(err) {
  const data = err?.response?.data;
  if (typeof data?.detail === "string") {
    return data.detail;
  }
  if (typeof data === "string") {
    return data;
  }
  for (const value of Object.values(data || {})) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
  }
  return "Не удалось создать заявку";
}

export function useAppointmentWizardForm() {
  const navigate = useNavigate();
  const storedDefaults = useMemo(() => readCreateDefaults(), []);
  const storedDraft = useMemo(() => readCreateDraft(), []);
  const initialForm = useMemo(
    () => buildInitialForm(storedDefaults, storedDraft),
    [storedDefaults, storedDraft]
  );

  const [form, setForm] = useState(initialForm);
  const [currentStep, setCurrentStep] = useState(
    Math.min(storedDraft.currentStep || 0, WIZARD_STEPS.length - 1)
  );
  const [touched, setTouched] = useState(() => buildInitialTouched(initialForm));
  const [error, setError] = useState("");
  const [ruInputsUnlocked, setRuInputsUnlocked] = useState(false);

  const errors = useMemo(() => getAppointmentWizardErrors(form), [form]);
  const hasStoredAccess = Boolean(storedDefaults.rustdesk_id || storedDefaults.rustdesk_password);
  const timingEstimate = useMemo(() => estimateAppointmentTiming(form), [form]);

  useEffect(() => {
    writeCreateDraft({ currentStep, form });
  }, [currentStep, form]);

  const createMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: (response) => {
      writeCreateDefaults({
        rustdesk_id: form.rustdesk_id.replace(/[\s-]+/g, "").trim(),
        rustdesk_password: String(form.rustdesk_password || "").trim(),
      });
      clearCreateDraft();
      navigate(`/appointments/${response.data.id}`);
    },
    onError: (err) => {
      setError(resolveCreateError(err));
    },
  });

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) {
      setError("");
    }
  };

  const markTouched = (key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const markStepTouched = (stepIndex) => {
    const fields =
      {
        0: ["brand", "model", "has_pc"],
        1: ["rustdesk_id", "rustdesk_password", "photo_lock_screen"],
      }[stepIndex] || [];

    setTouched((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        next[field] = true;
      });
      return next;
    });
  };

  const goToStep = (stepIndex) => {
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
      return;
    }

    for (let index = 0; index < stepIndex; index += 1) {
      if (hasStepErrors(errors, index)) {
        markStepTouched(index);
        setCurrentStep(index);
        setError("Заполните обязательные поля перед переходом дальше");
        return;
      }
    }

    setCurrentStep(stepIndex);
  };

  const nextStep = () => {
    markStepTouched(currentStep);
    if (hasStepErrors(errors, currentStep)) {
      setError("Заполните обязательные поля текущего шага");
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    setError("");
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setError("");
  };

  const submit = async () => {
    const firstInvalidStep = findFirstInvalidStep(errors);
    if (firstInvalidStep >= 0) {
      markStepTouched(firstInvalidStep);
      setCurrentStep(firstInvalidStep);
      setError("Проверьте форму перед отправкой");
      return;
    }

    setError("");
    await createMutation.mutateAsync(buildCreateAppointmentPayload(form));
  };

  return {
    currentStep,
    steps: WIZARD_STEPS,
    form,
    touched,
    errors,
    error,
    hasStoredAccess,
    ruInputsUnlocked,
    draftMeta: storedDraft.meta || {},
    timingEstimate,
    isSubmitting: createMutation.isPending,
    isCurrentStepValid: !hasStepErrors(errors, currentStep),
    canGoBack: currentStep > 0,
    canGoNext: currentStep < WIZARD_STEPS.length - 1,
    updateField,
    markTouched,
    unlockRuInputs: () => setRuInputsUnlocked(true),
    goToStep,
    nextStep,
    prevStep,
    submit,
  };
}
