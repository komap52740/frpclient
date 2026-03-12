import { Box, Chip, Paper, Stack, Typography } from "@mui/material";

import ActiveBoardCard from "./ActiveBoardCard";

export default function MasterActiveBoard({
  columns,
  itemsByColumn,
  selectedIds,
  onToggleSelect,
  onOpenCard,
  onOpenChat,
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(260px, 1fr))",
        gap: 1.5,
        overflowX: "auto",
        pb: 0.5,
      }}
    >
      {columns.map((column) => {
        const items = itemsByColumn[column.id] || [];
        return (
          <Paper
            key={column.id}
            sx={{
              p: 1.2,
              borderRadius: 2.2,
              minHeight: 380,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={1}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
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
                  variant="outlined"
                  color={items.length ? "primary" : "default"}
                  label={items.length}
                />
              </Stack>

              <Stack spacing={1}>
                {items.length ? (
                  items.map((item) => (
                    <ActiveBoardCard
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(item.id)}
                      onSelect={onToggleSelect}
                      onOpenCard={onOpenCard}
                      onOpenChat={onOpenChat}
                    />
                  ))
                ) : (
                  <Box
                    sx={{
                      minHeight: 150,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      border: "1px dashed",
                      borderColor: "divider",
                      textAlign: "center",
                      px: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Здесь пока пусто
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}
