import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useTasks } from "./use-tasks";
import { useGridLayout } from "./useGridLayout";
import { TaskGrid } from "./TaskGrid";
import { PaginationBar } from "./PaginationBar";
import { EmptyState } from "./EmptyState";
import { CreateTaskModal } from "./CreateTaskModal";
import { taskReorder } from "./task-service";
import { TaskCardContextMenu } from "./TaskCardContextMenu";
import { GraphView } from "./GraphView";
import type { HighlightState } from "./TaskCard";
import styles from "./GridView.module.css";

interface ContextMenuState {
  taskId: string;
  taskStatus: string;
  taskTitle: string;
  position: { x: number; y: number };
}

interface GridViewProps {
  onSelectTask: (id: string, priorityIndex: number) => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

export function GridView({ onSelectTask, initialPage, onPageChange }: GridViewProps) {
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const { tasks, setTasks, dependencies, loading, refresh } = useTasks(activeTab);
  const { cols, cardsPerPage, containerRef } = useGridLayout();
  const [currentPage, setCurrentPage] = useState(initialPage ?? 1);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const movedTaskIdRef = useRef<string | null>(null);
  const tasksVersionRef = useRef(0);
  const dragStartVersionRef = useRef(0);

  const totalPages = cardsPerPage > 0 ? Math.ceil(tasks.length / cardsPerPage) : 0;

  // Lookup maps: taskId → set of direct blocker/dependent task ids
  const blockersByTask = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of dependencies) {
      let set = map.get(edge.dependentTaskId);
      if (!set) {
        set = new Set();
        map.set(edge.dependentTaskId, set);
      }
      set.add(edge.blockerTaskId);
    }
    return map;
  }, [dependencies]);

  const dependentsByTask = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of dependencies) {
      let set = map.get(edge.blockerTaskId);
      if (!set) {
        set = new Set();
        map.set(edge.blockerTaskId, set);
      }
      set.add(edge.dependentTaskId);
    }
    return map;
  }, [dependencies]);

  // Compute per-card highlight states based on hovered task (disabled on archive tab)
  const highlightStates = useMemo(() => {
    if (activeTab === "archive") return undefined;
    if (!hoveredTaskId) return undefined;
    const states: Record<string, HighlightState> = {};
    const blockers = blockersByTask.get(hoveredTaskId) ?? new Set();
    const deps = dependentsByTask.get(hoveredTaskId) ?? new Set();
    for (const task of tasks) {
      if (task.id === hoveredTaskId) {
        states[task.id] = null;
      } else if (blockers.has(task.id)) {
        states[task.id] = "blocker";
      } else if (deps.has(task.id)) {
        states[task.id] = "dependent";
      } else {
        states[task.id] = "dimmed";
      }
    }
    return states;
  }, [hoveredTaskId, tasks, blockersByTask, dependentsByTask]);

  // Clamp currentPage when totalPages changes (resize or task removal)
  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Notify parent of page changes for state preservation
  useEffect(() => {
    onPageChange?.(currentPage);
  }, [currentPage, onPageChange]);

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
      const task = tasks.find((t) => t.id === taskId);
      setContextMenu({ taskId, position, taskStatus: task?.status ?? "active", taskTitle: task?.title ?? "" });
    },
    [tasks],
  );

  const handleCardMouseEnter = useCallback((taskId: string) => {
    setHoveredTaskId(taskId);
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    setHoveredTaskId(null);
  }, []);

  if (loading) {
    return (
      <div className={styles.container} data-testid="grid-loading">
        Loading...
      </div>
    );
  }

  const startIndex = (currentPage - 1) * cardsPerPage;
  const pageTasks = tasks.slice(startIndex, startIndex + cardsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.tabBar} data-testid="tab-bar">
        <button
          className={activeTab === "active" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => { setActiveTab("active"); setCurrentPage(1); }}
          data-testid="tab-active"
        >
          Active
        </button>
        <button
          className={activeTab === "archive" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => { setActiveTab("archive"); setCurrentPage(1); }}
          data-testid="tab-archive"
        >
          Archive
        </button>
      </div>
      <div className={styles.header}>
        {activeTab === "active" && (
          <button
            className={styles.addButton}
            onClick={() => setShowCreateModal(true)}
            data-testid="add-task-button"
          >
            + Add task
          </button>
        )}
        {activeTab === "active" && tasks.length > 0 && (
          <button
            className={styles.graphButton}
            onClick={() => setShowGraph(true)}
            data-testid="graph-view-button"
          >
            Graph View
          </button>
        )}
      </div>
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
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
              highlightStates={highlightStates}
              onCardMouseEnter={handleCardMouseEnter}
              onCardMouseLeave={handleCardMouseLeave}
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
              taskStatus={contextMenu.taskStatus}
              taskTitle={contextMenu.taskTitle}
              onMoveToTop={handleMoveToTop}
              onMoveToBottom={handleMoveToBottom}
              onClose={() => setContextMenu(null)}
              onRefresh={refresh}
            />
          )}
        </>
      )}
      {showCreateModal && (
        <CreateTaskModal
          onCreated={refresh}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      {showGraph && (
        <GraphView
          tasks={tasks}
          dependencies={dependencies}
          onSelectTask={(taskId: string) => {
            setShowGraph(false);
            const index = tasks.findIndex((t) => t.id === taskId);
            onSelectTask(taskId, index + 1);
          }}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  );
}
