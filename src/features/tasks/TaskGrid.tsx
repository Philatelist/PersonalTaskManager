import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { TaskWithProgress } from "./use-tasks";
import { TaskCard } from "./TaskCard";
import { altArrowCoordinateGetter } from "./keyboard-coordinates";
import styles from "./TaskGrid.module.css";

interface TaskGridProps {
  tasks: TaskWithProgress[];
  columns: number;
  startIndex?: number;
  allTasks?: TaskWithProgress[];
  onSelectTask: (id: string) => void;
  onUpdated?: () => void;
  onReorder?: (taskId: string, afterId: string | null) => void;
  onDragStart?: () => void;
  onCardContextMenu?: (taskId: string, position: { x: number; y: number }) => void;
}

export function TaskGrid({
  tasks,
  columns,
  startIndex = 0,
  allTasks,
  onSelectTask,
  onUpdated,
  onReorder,
  onDragStart: onDragStartProp,
  onCardContextMenu,
}: TaskGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: altArrowCoordinateGetter,
    }),
  );

  const taskIds = tasks.map((t) => t.id);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    onDragStartProp?.();
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over || !onReorder) return;

    const oldIndex = taskIds.indexOf(String(active.id));
    const newIndex = taskIds.indexOf(String(over.id));

    // Same-position guard
    if (oldIndex === newIndex) return;

    const taskId = String(active.id);

    // Compute afterId based on new position
    let afterId: string | null;
    if (newIndex === 0) {
      // Dropped at first position on this page
      if (startIndex === 0) {
        // Page 1: move to top
        afterId = null;
      } else {
        // Page N: place after the last task on the previous page
        afterId = allTasks ? allTasks[startIndex - 1].id : null;
      }
    } else {
      // Place after the task that's now just before the drop position
      // We need to consider the array *after* the move
      const reordered = arrayMove(tasks, oldIndex, newIndex);
      afterId = reordered[newIndex - 1].id;
    }

    onReorder(taskId, afterId);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeIndex = activeId ? taskIds.indexOf(activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={taskIds} strategy={rectSortingStrategy}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          data-testid="task-grid"
        >
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              globalIndex={startIndex + index + 1}
              task={task}
              onSelect={onSelectTask}
              onUpdated={onUpdated}
              onContextMenu={onCardContextMenu}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask ? (
          <div style={{ opacity: 0.7 }}>
            <TaskCard
              globalIndex={startIndex + activeIndex + 1}
              task={activeTask}
              onSelect={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
