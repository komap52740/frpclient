import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SchemaRoundedIcon from "@mui/icons-material/SchemaRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Alert,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../../../api/client";
import {
  buildRuleBuilderGraph,
  buildRulePayload,
  createInitialRuleForm,
  FALLBACK_RULE_SCHEMA,
  formatActionSummary,
  formatConditionLabel,
  formatConditionPreview,
  getAvailableOperators,
  getSelectedConditionField,
  normalizeRuleSchema,
  resolveActionLabel,
} from "../lib/ruleFormAdapter";
import RuleBuilderCanvas from "../ui/RuleBuilderCanvas";
import RuleInspectorDrawer from "../ui/RuleInspectorDrawer";

export default function AdminRulesPage() {
  const [rows, setRows] = useState([]);
  const [schema, setSchema] = useState(FALLBACK_RULE_SCHEMA);
  const [schemaError, setSchemaError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState("trigger");
  const [form, setForm] = useState(() => createInitialRuleForm(FALLBACK_RULE_SCHEMA));

  const load = async () => {
    try {
      const [rulesResponse, schemaResponse] = await Promise.allSettled([
        adminApi.rules(),
        adminApi.rulesSchema(),
      ]);

      if (rulesResponse.status === "fulfilled") {
        setRows(rulesResponse.value.data || []);
        setError("");
      } else {
        setError("Не удалось загрузить правила автоматизации");
      }

      if (schemaResponse.status === "fulfilled") {
        const nextSchema = normalizeRuleSchema(schemaResponse.value.data);
        setSchema(nextSchema);
        setSchemaError("");
        setForm((prev) =>
          prev.name || prev.triggerEvent ? prev : createInitialRuleForm(nextSchema)
        );
      } else {
        setSchema(FALLBACK_RULE_SCHEMA);
        setSchemaError("Schema endpoint недоступен. Использован локальный fallback.");
      }
    } catch {
      setError("Не удалось загрузить правила автоматизации");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const normalizedSchema = normalizeRuleSchema(schema);
  const selectedConditionField = useMemo(
    () => getSelectedConditionField(normalizedSchema, form.conditionField),
    [normalizedSchema, form.conditionField]
  );
  const availableOperators = useMemo(
    () => getAvailableOperators(normalizedSchema, form.conditionField),
    [normalizedSchema, form.conditionField]
  );

  useEffect(() => {
    if (
      !availableOperators.some((operator) => operator.value === form.conditionOp) &&
      availableOperators[0]
    ) {
      setForm((prev) => ({ ...prev, conditionOp: availableOperators[0].value }));
    }
  }, [availableOperators, form.conditionOp]);

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);
  const builderGraph = useMemo(
    () =>
      buildRuleBuilderGraph(normalizedSchema, form, selectedStep, (step) => {
        setSelectedStep(step);
        setInspectorOpen(true);
      }),
    [form, normalizedSchema, selectedStep]
  );
  const payloadPreview = useMemo(
    () => buildRulePayload(form, normalizedSchema),
    [form, normalizedSchema]
  );

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetDraft = () => {
    setForm(createInitialRuleForm(normalizedSchema));
    setSelectedStep("trigger");
    setSuccess("");
    setError("");
  };

  const handleCreateRule = async () => {
    const payload = buildRulePayload(form, normalizedSchema);

    if (!payload.name) {
      setError("Укажите название правила");
      setInspectorOpen(true);
      setSelectedStep("trigger");
      return;
    }
    if (form.actionType === "assign_tag" && !String(form.actionTag || "").trim()) {
      setError("Укажите тег для действия assign_tag");
      setInspectorOpen(true);
      setSelectedStep("action");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adminApi.createRule(payload);
      setSuccess("Правило создано");
      setForm(createInitialRuleForm(normalizedSchema));
      setSelectedStep("trigger");
      setInspectorOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Не удалось создать правило");
      setInspectorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (row) => {
    try {
      await adminApi.updateRule(row.id, { is_active: !row.is_active });
      await load();
    } catch {
      setError("Не удалось обновить правило");
    }
  };

  const removeRule = async (ruleId) => {
    try {
      await adminApi.deleteRule(ruleId);
      await load();
    } catch {
      setError("Не удалось удалить правило");
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.35}>
          <Typography variant="h2">Rules Builder</Typography>
          <Typography variant="body2" color="text.secondary">
            Visual editor для platform automation: trigger, condition и action на одном экране.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Активных: ${activeCount}`} color="primary" />
          <Chip label={`Всего правил: ${rows.length}`} variant="outlined" />
        </Stack>
      </Stack>

      {schemaError ? <Alert severity="warning">{schemaError}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Stack spacing={0.35}>
                  <Typography variant="h3">Visual graph</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Нажмите на node, чтобы открыть inspector с нужной секцией.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<TuneRoundedIcon />}
                    onClick={() => setInspectorOpen(true)}
                  >
                    Открыть inspector
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SchemaRoundedIcon />}
                    onClick={handleCreateRule}
                    disabled={saving}
                  >
                    {saving ? "Сохраняем..." : "Создать rule"}
                  </Button>
                </Stack>
              </Stack>

              <RuleBuilderCanvas
                nodes={builderGraph.nodes}
                edges={builderGraph.edges}
                onNodeSelect={(step) => {
                  setSelectedStep(step);
                  setInspectorOpen(true);
                }}
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.2}>
              <Typography variant="h3">Draft summary</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`Trigger: ${form.triggerEvent}`} />
                <Chip size="small" variant="outlined" label={`Action: ${form.actionType}`} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={form.conditionEnabled ? "Condition on" : "Condition off"}
                />
              </Stack>
              <Typography variant="body2">
                <b>Condition:</b> {formatConditionLabel(normalizedSchema, form)}
              </Typography>
              <Typography variant="body2">
                <b>Action:</b> {formatActionSummary(normalizedSchema, form)}
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5 }}>
                <Stack spacing={0.7}>
                  <Typography variant="caption" color="text.secondary">
                    Payload preview
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{ whiteSpace: "pre-wrap", m: 0, fontSize: 12, fontFamily: "monospace" }}
                  >
                    {JSON.stringify(payloadPreview, null, 2)}
                  </Typography>
                </Stack>
              </Paper>
              <Button variant="outlined" onClick={handleResetDraft}>
                Сбросить draft
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.1}>
          <Typography variant="h3">Schema contract</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              variant="outlined"
              label={`Triggers: ${normalizedSchema.event_types?.length || 0}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Condition fields: ${normalizedSchema.condition_fields?.length || 0}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Operators: ${normalizedSchema.operators?.length || 0}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Actions: ${normalizedSchema.actions?.length || 0}`}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Источник для UI: `GET /api/v1/admin/rules/schema/`. Builder больше не живет на ручном
            hardcode.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto", borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Событие</TableCell>
              <TableCell>Условие</TableCell>
              <TableCell>Активно</TableCell>
              <TableCell>Действие</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.trigger_event_type}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {formatConditionPreview(row.condition_json)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Switch checked={row.is_active} onChange={() => toggleRule(row)} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {resolveActionLabel(normalizedSchema, row.action_json?.type || "")}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    size="small"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() => removeRule(row.id)}
                  >
                    Удалить
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    Правила пока не созданы.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>

      <RuleInspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        selectedStep={selectedStep}
        onSelectStep={setSelectedStep}
        form={form}
        schema={normalizedSchema}
        selectedConditionField={selectedConditionField}
        availableOperators={availableOperators}
        onFieldChange={handleFieldChange}
        onCreateRule={handleCreateRule}
        onResetDraft={handleResetDraft}
        saving={saving}
      />
    </Stack>
  );
}
