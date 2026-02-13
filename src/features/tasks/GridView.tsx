import { useState, useEffect, useCallback, useRef } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTasks } from "./use-tasks";
import { useGridLayout } from "./useGridLayout";
import { TaskGrid } from "./TaskGrid";
import { PaginationBar } from "./PaginationBar";
import { EmptyState } from "./EmptyState";
import { taskReorder } from "./task-service";
import { TaskCardContextMenu } from "./TaskCardContextMenu";
import styles from "./GridView.module.css";

interface ContextMenuState {
  taskId: string;
  position: { x: number; y: number };
}

interface GridViewProps {
  onSelectTask: (id: string) => void;
}

export function GridView({ onSelectTask }: GridViewProps) {
  const { tasks, setTasks, loading, refresh } = useTasks();
  const { cols, cardsPerPage, containerRef } = useGridLayout();
  const [currentPage, setCurrentPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const movedTaskIdRef = useRef<string | null>(null);
  const tasksVersionRef = useRef(0);
  const dragStartVersionRef = useRef(0);

  const totalPages = cardsPerPage > 0 ? Math.ceil(tasks.length / cardsPerPage) : 0;

  // Clamp currentPage when totalPages changes (resize or task removal)
  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Restore focus to the moved card's drag handle after reorder
  useEffect(() => {
    const id = movedTaskIdRef.current;
    if (!id) return;
    movedTaskIdRef.current = null;
    const handle = document.querySelector(
      `[data-task-id="${id}"] [data-drag-handle]`,
    );
    if (handle instanceof HTMLElement) {
      handle.focus();
    }
  }, [tasks]);

  // Track tasks version for concurrent change detection
  useEffect(() => {
    tasksVersionRef.current += 1;
  }, [tasks]);

  const handleDragStart = useCallback(() => {
    dragStartVersionRef.current = tasksVersionRef.current;
  }, []);

  const handleReorder = useCallback(
    async (taskId: string, afterId: string | null) => {
      // Concurrent change safety: discard if tasks changed during drag
      if (tasksVersionRef.current !== dragStartVersionRef.current) return;

      movedTaskIdRef.current = taskId;
      // Optimistic reorder: move the task in the local array immediately
      const oldIndex = tasks.findIndex((t) => t.id === taskId);
      let newIndex: number;
      if (afterId === null) {
        newIndex = 0;
      } else {
        const afterIndex = tasks.findIndex((t) => t.id === afterId);
        newIndex = afterIndex + 1;
        // If moving backward, the target stays the same; if forward,
        // account for the item being removed before insertion
        if (oldIndex < newIndex) {
          newIndex -= 1;
        }
      }

      if (oldIndex !== -1 && oldIndex !== newIndex) {
        setTasks(arrayMove(tasks, oldIndex, newIndex));
      }

      try {
        await taskReorder(taskId, afterId);
      } catch {
        // Backend failure — refresh will restore correct state
      } finally {
        await refresh();
      }
    },
    [tasks, setTasks, refresh],
  );

  const handleMoveToTop = useCallback(
    async (taskId: string) => {
      try {
        await taskReorder(taskId, null);
      } catch {
        // Backend failure — refresh will restore correct state
      } finally {
        await refresh();
      }
      setCurrentPage(1);
    },
    [refresh],
  );

  const handleMoveToBottom = useCallback(
    async (taskId: string) => {
      if (tasks.length > 0 && taskId === tasks[tasks.length - 1].id) return;
      const afterId = tasks.filter((t) => t.id !== taskId).at(-1)!.id;
      try {
        await taskReorder(taskId, afterId);
      } catch {
        // Backend failure — refresh will restore correct state
      } finally {
        await refresh();
      }
      const newTotalPages = cardsPerPage > 0 ? Math.ceil(tasks.length / cardsPerPage) : 1;
      setCurrentPage(newTotalPages);
    },
    [tasks, cardsPerPage, refresh],
  );

  const handleCardContextMenu = useCallback(
    (taskId: string, position: { x: number; y: number }) => {
      setContextMenu({ taskId, position });
    },
    [],
  );

  if (loading) {
    return (
      <div className={styles.container} data-testid="grid-loading">
        Loading...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState />
      </div>
    );
  }

  const startIndex = (currentPage - 1) * cardsPerPage;
  const pageTasks = tasks.slice(startIndex, startIndex + cardsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.gridArea} ref={containerRef}>
        <TaskGrid
          tasks={pageTasks}
          columns={cols}
          startIndex={startIndex}
          allTasks={tasks}
          onSelectTask={onSelectTask}
          onUpdated={refresh}
          onReorder={handleReorder}
          onDragStart={handleDragStart}
          onCardContextMenu={handleCardContextMenu}
        />
      </div>
      {totalPages > 1 && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
      {contextMenu && (
        <TaskCardContextMenu
          position={contextMenu.position}
          taskId={contextMenu.taskId}
          onMoveToTop={handleMoveToTop}
          onMoveToBottom={handleMoveToBottom}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
