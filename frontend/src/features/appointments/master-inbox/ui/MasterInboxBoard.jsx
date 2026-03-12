import { closestCorners, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Grid } from "@mui/material";
import { useMemo } from "react";

import InboxCard from "./InboxCard";
import InboxColumn from "./InboxColumn";

function resolveColumnId(over) {
  const explicit = over?.data?.current?.columnId;
  if (explicit) {
    return explicit;
  }
  if (typeof over?.id === "string" && over.id.startsWith("column:")) {
    return over.id.replace("column:", "");
  }
  return null;
}

export default function MasterInboxBoard({
  columns,
  itemsByColumn,
  draggableColumnIds = [],
  onMoveCard,
  onOpenCard,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const columnIds = useMemo(() => new Set(draggableColumnIds), [draggableColumnIds]);

  const handleDragEnd = async ({ active, over }) => {
    const appointmentId = active?.data?.current?.appointmentId;
    const fromColumnId = active?.data?.current?.columnId;
    const toColumnId = resolveColumnId(over);

    if (!appointmentId || !fromColumnId || !toColumnId || fromColumnId === toColumnId) {
      return;
    }

    await onMoveCard?.({ appointmentId, fromColumnId, toColumnId });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <Grid container spacing={1.5}>
        {columns.map((column) => {
          const items = itemsByColumn[column.id] || [];
          return (
            <Grid key={column.id} item xs={12} md={6}>
              <InboxColumn column={column} items={items}>
                {items.map((item) => (
                  <InboxCard
                    key={item.id}
                    item={item}
                    columnId={column.id}
                    draggable={columnIds.has(column.id)}
                    onOpen={onOpenCard}
                  />
                ))}
              </InboxColumn>
            </Grid>
          );
        })}
      </Grid>
    </DndContext>
  );
}
