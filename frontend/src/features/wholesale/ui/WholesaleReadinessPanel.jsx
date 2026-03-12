import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { getWholesaleStatusMeta } from "../lib/portalLabels";
import { buildWholesaleReadiness } from "../lib/readiness";

function ReadinessItem({ item }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      {item.done ? (
        <CheckCircleRoundedIcon color="success" sx={{ mt: 0.15, fontSize: 18 }} />
      ) : (
        <RadioButtonUncheckedRoundedIcon color="disabled" sx={{ mt: 0.15, fontSize: 18 }} />
      )}
      <Stack spacing={0.2}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {item.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.hint}
        </Typography>
      </Stack>
    </Stack>
  );
}

function resolveActionProps(action) {
  if (!action) {
    return {};
  }
  if (action.href) {
    return {
      component: "a",
      href: action.href,
      target: "_blank",
      rel: "noreferrer",
    };
  }
  return {
    component: RouterLink,
    to: action.to,
  };
}

export default function WholesaleReadinessPanel({ wholesale, title = "", showActions = true }) {
  const readiness = buildWholesaleReadiness(wholesale);
  const statusMeta = getWholesaleStatusMeta(readiness.status);

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={1.2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Stack spacing={0.45}>
            <Typography variant="h3">{title || readiness.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {readiness.description}
            </Typography>
          </Stack>
          <Chip
            size="small"
            color={statusMeta.chipColor}
            variant={statusMeta.chipVariant}
            label={`Статус: ${statusMeta.label}`}
          />
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
          <Stack spacing={1} sx={{ flex: 1 }}>
            {readiness.checklist.map((item) => (
              <ReadinessItem key={item.key} item={item} />
            ))}
          </Stack>
          <Stack spacing={0.8} sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {readiness.queueHint}
            </Typography>
            {readiness.note ? (
              <Typography variant="body2" color="text.secondary">
                {readiness.note}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        {showActions ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" {...resolveActionProps(readiness.primaryAction)}>
              {readiness.primaryAction.label}
            </Button>
            {readiness.secondaryAction ? (
              <Button variant="outlined" {...resolveActionProps(readiness.secondaryAction)}>
                {readiness.secondaryAction.label}
              </Button>
            ) : null}
            <Button
              variant="text"
              endIcon={<OpenInNewRoundedIcon />}
              {...resolveActionProps({ href: readiness.supportUrl })}
            >
              Поддержка {readiness.supportTelegram}
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
