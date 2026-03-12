import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

import AppointmentCard from "../../../../components/AppointmentCard";

export default function InboxCard({ item, columnId, draggable = false, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `appointment:${item.id}`,
    data: { appointmentId: item.id, columnId },
    disabled: !draggable,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          borderRadius: 2,
          borderStyle: "dashed",
          borderColor: isDragging ? "primary.main" : "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={0.8} alignItems="center">
              {draggable ? (
                <Box
                  {...attributes}
                  {...listeners}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                    cursor: "grab",
                    touchAction: "none",
                  }}
                >
                  <DragIndicatorRoundedIcon fontSize="small" />
                </Box>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                {draggable ? "Drag & drop" : "Активная заявка"}
              </Typography>
            </Stack>
            <Button
              size="small"
              endIcon={<OpenInNewRoundedIcon fontSize="small" />}
              onClick={() => onOpen(item)}
            >
              Открыть
            </Button>
          </Stack>
          <AppointmentCard item={item} role="master" linkTo={`/appointments/${item.id}`} />
        </Stack>
      </Paper>
    </Box>
  );
}
