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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Subtask } from "./types";
import { subtaskCreate, subtaskReorder } from "./task-service";
import { SubtaskItem } from "./SubtaskItem";
import styles from "./SubtaskSection.module.css";

interface SubtaskSectionProps {
  subtasks: Subtask[];
  taskId: string;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onUpdated: () => void;
}

export function SubtaskSection({
  subtasks,
  taskId,
  onToggle,
  onDelete,
  onUpdated,
}: SubtaskSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIds = subtasks.map((s) => s.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new order
    const newIds = [...currentIds];
    newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, String(active.id));

    // Same-position guard
    if (newIds.every((id, i) => id === currentIds[i])) return;

    await subtaskReorder(taskId, newIds);
    onUpdated();
  };

  const handleAddKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        await subtaskCreate(taskId, "checklist", trimmed);
        setInputValue("");
        onUpdated();
      }
    }
  };

  const activeSubtask = activeId
    ? subtasks.find((s) => s.id === activeId)
    : null;

  return (
    <div data-testid="subtask-section">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {subtasks.length > 0 && (
            <div className={styles.list} data-testid="subtask-list">
              {subtasks.map((subtask) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </SortableContext>

        <DragOverlay>
          {activeSubtask && (
            <SubtaskItem
              subtask={activeSubtask}
              onToggle={() => {}}
              onDelete={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>

      <input
        className={styles.addInput}
        type="text"
        placeholder="Add subtask..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleAddKeyDown}
        aria-label="Add subtask"
        data-testid="subtask-add-input"
      />
    </div>
  );
}
