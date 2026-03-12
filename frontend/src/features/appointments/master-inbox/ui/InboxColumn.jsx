import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

export default function InboxColumn({ column, items, children }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: { columnId: column.id },
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1.2,
        borderRadius: 2.2,
        minHeight: 420,
        border: "1px solid",
        borderColor: isOver ? "primary.main" : "divider",
        bgcolor: isOver ? "action.hover" : "background.paper",
        transition: "border-color .18s ease, background-color .18s ease",
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack spacing={0.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {column.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {column.description}
            </Typography>
          </Stack>
          <Chip
            size="small"
            label={items.length}
            color={items.length ? "primary" : "default"}
            variant="outlined"
          />
        </Stack>

        <SortableContext
          items={items.map((item) => `appointment:${item.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <Stack spacing={1}>
            {items.length ? (
              children
            ) : (
              <Box
                sx={{
                  minHeight: 180,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 2,
                  border: "1px dashed",
                  borderColor: "divider",
                  color: "text.secondary",
                  textAlign: "center",
                  px: 2,
                }}
              >
                <Typography variant="body2">
                  {isOver ? "Отпустите карточку здесь" : "Пока пусто"}
                </Typography>
              </Box>
            )}
          </Stack>
        </SortableContext>
      </Stack>
    </Paper>
  );
}
