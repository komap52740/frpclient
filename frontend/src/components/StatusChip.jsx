import { Chip } from "@mui/material";

import { resolveStatusUI } from "../theme/status";

export default function StatusChip({ status, slaBreached = false }) {
  const ui = resolveStatusUI(status, slaBreached);

  return (
    <Chip
      size="small"
      label={ui.label}
      sx={{
        bgcolor: ui.bg,
        color: ui.color,
        border: `1px solid ${ui.color}33`,
      }}
    />
  );
}
