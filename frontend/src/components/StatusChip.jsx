import { Chip } from "@mui/material";

import { getStatusLabel } from "../constants/labels";

const colorByStatus = {
  NEW: "default",
  IN_REVIEW: "info",
  AWAITING_PAYMENT: "warning",
  PAYMENT_PROOF_UPLOADED: "warning",
  PAID: "success",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  DECLINED_BY_MASTER: "error",
  CANCELLED: "error",
};

export default function StatusChip({ status }) {
  return <Chip size="small" label={getStatusLabel(status)} color={colorByStatus[status] || "default"} />;
}
