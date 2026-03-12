import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Handle, Position } from "reactflow";

export default function RuleNodeCard({
  color,
  data,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}) {
  return (
    <Box
      sx={{
        width: 250,
        borderRadius: 2,
        border: "1px solid",
        borderColor: data?.selected ? color : "divider",
        background: data?.selected ? `${color}12` : "background.paper",
        boxShadow: data?.selected ? `0 0 0 2px ${color}22` : "0 10px 30px rgba(15,23,42,0.08)",
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={targetPosition} style={{ background: color }} />
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <Typography variant="overline" sx={{ color, fontWeight: 800, letterSpacing: 0.8 }}>
          {data?.title || "Node"}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {data?.primary || "—"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data?.secondary || "Настройте параметры в инспекторе"}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditRoundedIcon />}
          onClick={data?.onSelect}
        >
          Edit
        </Button>
      </Stack>
      <Handle type="source" position={sourcePosition} style={{ background: color }} />
    </Box>
  );
}
