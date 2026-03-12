import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../../../constants/labels";

export const FALLBACK_RULE_SCHEMA = {
  event_types: [
    { value: "appointment.created", label: "Создана заявка" },
    { value: "appointment.master_taken", label: "Мастер взял заявку" },
    { value: "appointment.price_set", label: "Выставлена цена" },
    { value: "appointment.payment_marked", label: "Оплата отмечена" },
    { value: "appointment.payment_confirmed", label: "Оплата подтверждена" },
    { value: "appointment.work_started", label: "Работа начата" },
    { value: "appointment.work_completed", label: "Работа завершена" },
    { value: "chat.message_sent", label: "Сообщение в чате" },
    { value: "review.master_created", label: "Отзыв о мастере" },
    { value: "review.client_created", label: "Отзыв о клиенте" },
    { value: "sla.breached", label: "Нарушен SLA" },
    { value: "wholesale.requested", label: "Запрошен B2B-статус" },
  ],
  condition_fields: [
    {
      value: "appointment.status",
      label: "Статус заявки",
      type: "enum",
      supported_operators: ["==", "!=", "in", "not_in"],
      options: APPOINTMENT_STATUS_OPTIONS.map((status) => ({
        value: status,
        label: getStatusLabel(status),
      })),
    },
    {
      value: "appointment.total_price",
      label: "Цена заявки",
      type: "number",
      supported_operators: ["==", "!=", ">", ">=", "<", "<="],
    },
    {
      value: "client.risk_level",
      label: "Уровень риска клиента",
      type: "enum",
      supported_operators: ["==", "!=", "in", "not_in", ">=", "<="],
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    },
    {
      value: "client.risk_score",
      label: "Risk score клиента",
      type: "number",
      supported_operators: ["==", "!=", ">", ">=", "<", "<="],
    },
    {
      value: "event.event_type",
      label: "Тип события",
      type: "enum",
      supported_operators: ["==", "!=", "in", "not_in"],
      options: [],
    },
  ],
  operators: [
    { value: "==", label: "Равно" },
    { value: "!=", label: "Не равно" },
    { value: ">=", label: "Больше или равно" },
    { value: "<=", label: "Меньше или равно" },
    { value: ">", label: "Больше" },
    { value: "<", label: "Меньше" },
    { value: "in", label: "Входит в список" },
    { value: "not_in", label: "Не входит в список" },
    { value: "contains", label: "Содержит" },
  ],
  actions: [
    { value: "request_admin_attention", label: "Запросить внимание админа" },
    { value: "create_notification", label: "Создать уведомление" },
    { value: "assign_tag", label: "Назначить тег" },
    { value: "change_status", label: "Изменить статус заявки" },
  ],
  roles: [
    { value: "admin", label: "admin" },
    { value: "master", label: "master" },
    { value: "client", label: "client" },
  ],
  notification_targets: [
    { value: "admins", label: "Админам" },
    { value: "client", label: "Клиенту" },
    { value: "master", label: "Мастеру" },
    { value: "actor", label: "Инициатору события" },
    { value: "role", label: "Всем пользователям роли" },
  ],
};

export function createInitialRuleForm(schema = FALLBACK_RULE_SCHEMA) {
  return {
    name: "",
    triggerEvent: schema.event_types?.[0]?.value || "appointment.created",
    conditionEnabled: true,
    conditionField: schema.condition_fields?.[0]?.value || "appointment.status",
    conditionOp: schema.condition_fields?.[0]?.supported_operators?.[0] || "==",
    conditionValue: schema.condition_fields?.[0]?.options?.[0]?.value || "NEW",
    actionType: schema.actions?.[0]?.value || "request_admin_attention",
    actionTarget: schema.notification_targets?.[0]?.value || "admins",
    actionRole: schema.roles?.[0]?.value || "admin",
    actionToStatus: "IN_REVIEW",
    actionTag: "",
    actionTitle: "",
    actionMessage: "",
  };
}

export function normalizeRuleSchema(schema) {
  return schema || FALLBACK_RULE_SCHEMA;
}

export function getSelectedConditionField(schema, fieldValue) {
  const fields = normalizeRuleSchema(schema).condition_fields || [];
  return fields.find((option) => option.value === fieldValue) || fields[0] || null;
}

export function getAvailableOperators(schema, conditionFieldValue) {
  const normalized = normalizeRuleSchema(schema);
  const field = getSelectedConditionField(normalized, conditionFieldValue);
  const supported = new Set(field?.supported_operators || []);
  return (normalized.operators || []).filter((operator) => supported.has(operator.value));
}

export function parseConditionValue(rawValue, operator, fieldConfig) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (operator === "in" || operator === "not_in") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (fieldConfig?.type === "boolean") {
    return value === "true";
  }
  if (fieldConfig?.type === "number") {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }
  return value;
}

export function buildConditionJson(form, fieldConfig) {
  if (!form.conditionEnabled || !String(form.conditionValue || "").trim()) {
    return {};
  }
  return {
    all: [
      {
        field: form.conditionField,
        op: form.conditionOp,
        value: parseConditionValue(form.conditionValue, form.conditionOp, fieldConfig),
      },
    ],
  };
}

export function buildActionJson(form) {
  if (form.actionType === "change_status") {
    return { type: "change_status", to_status: form.actionToStatus };
  }
  if (form.actionType === "assign_tag") {
    return { type: "assign_tag", tag: String(form.actionTag || "").trim() };
  }
  if (form.actionType === "create_notification") {
    return {
      type: "create_notification",
      target: form.actionTarget,
      role: form.actionTarget === "role" ? form.actionRole || undefined : undefined,
      title: String(form.actionTitle || "").trim() || "Системное уведомление",
      message: String(form.actionMessage || "").trim() || "",
    };
  }
  return {
    type: "request_admin_attention",
    title: String(form.actionTitle || "").trim() || "Требуется внимание администратора",
    message: String(form.actionMessage || "").trim() || "",
  };
}

export function buildRulePayload(form, schema) {
  const fieldConfig = getSelectedConditionField(schema, form.conditionField);
  return {
    name: String(form.name || "").trim(),
    is_active: true,
    trigger_event_type: form.triggerEvent,
    condition_json: buildConditionJson(form, fieldConfig),
    action_json: buildActionJson(form),
  };
}

export function resolveActionLabel(schema, actionType) {
  return (
    normalizeRuleSchema(schema).actions?.find((option) => option.value === actionType)?.label ||
    actionType
  );
}

export function formatConditionLabel(schema, form) {
  if (!form.conditionEnabled) {
    return "Без условий";
  }
  const field = getSelectedConditionField(schema, form.conditionField);
  const operator = normalizeRuleSchema(schema).operators?.find(
    (item) => item.value === form.conditionOp
  );
  const rawValue = String(form.conditionValue || "").trim();
  return [field?.label || form.conditionField, operator?.label || form.conditionOp, rawValue]
    .filter(Boolean)
    .join(" ");
}

export function formatConditionPreview(conditionJson) {
  if (!conditionJson || !Object.keys(conditionJson).length) {
    return "Без условий";
  }
  try {
    return JSON.stringify(conditionJson);
  } catch {
    return "Без условий";
  }
}

export function formatActionSummary(schema, form) {
  const actionLabel = resolveActionLabel(schema, form.actionType);
  if (form.actionType === "change_status") {
    return `${actionLabel}: ${getStatusLabel(form.actionToStatus)}`;
  }
  if (form.actionType === "assign_tag") {
    return `${actionLabel}: ${String(form.actionTag || "").trim() || "tag"}`;
  }
  if (form.actionType === "create_notification") {
    return `${actionLabel}: ${form.actionTarget}`;
  }
  return actionLabel;
}

export function buildRuleBuilderGraph(schema, form, selectedStep, onSelectStep) {
  const normalized = normalizeRuleSchema(schema);
  const triggerLabel =
    normalized.event_types?.find((item) => item.value === form.triggerEvent)?.label ||
    form.triggerEvent;
  const conditionLabel = formatConditionLabel(normalized, form);
  const actionLabel = formatActionSummary(normalized, form);

  const triggerNode = {
    id: "trigger",
    type: "triggerNode",
    position: { x: 40, y: 120 },
    data: {
      title: "Trigger",
      primary: triggerLabel,
      secondary: form.name ? `Rule: ${form.name}` : "Выберите событие-триггер",
      selected: selectedStep === "trigger",
      onSelect: () => onSelectStep("trigger"),
    },
    draggable: false,
  };

  const actionNode = {
    id: "action",
    type: "actionNode",
    position: { x: 700, y: 120 },
    data: {
      title: "Action",
      primary: actionLabel,
      secondary: form.actionMessage
        ? String(form.actionMessage).slice(0, 96)
        : "Настройте итоговое действие",
      selected: selectedStep === "action",
      onSelect: () => onSelectStep("action"),
    },
    draggable: false,
  };

  if (!form.conditionEnabled) {
    return {
      nodes: [triggerNode, actionNode],
      edges: [
        {
          id: "trigger-action",
          source: "trigger",
          target: "action",
          animated: true,
          style: { stroke: "#2563eb", strokeWidth: 2.5 },
        },
      ],
    };
  }

  const conditionNode = {
    id: "condition",
    type: "conditionNode",
    position: { x: 370, y: 120 },
    data: {
      title: "Condition",
      primary: conditionLabel,
      secondary: "Фильтр перед запуском action",
      selected: selectedStep === "condition",
      onSelect: () => onSelectStep("condition"),
    },
    draggable: false,
  };

  return {
    nodes: [triggerNode, conditionNode, actionNode],
    edges: [
      {
        id: "trigger-condition",
        source: "trigger",
        target: "condition",
        animated: true,
        style: { stroke: "#2563eb", strokeWidth: 2.5 },
      },
      {
        id: "condition-action",
        source: "condition",
        target: "action",
        animated: true,
        style: { stroke: "#7c3aed", strokeWidth: 2.5 },
      },
    ],
  };
}
