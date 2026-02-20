import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { taskList } from "./task-service";
import type { Task } from "./types";
import styles from "./TaskRefSearchModal.module.css";

interface TaskRefSearchModalProps {
  taskId: string;
  onSelect: (refTaskId: string) => void;
  onClose: () => void;
}

export function TaskRefSearchModal({
  taskId,
  onSelect,
  onClose,
}: TaskRefSearchModalProps) {
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    taskList({ statusFilter: "active" }).then((result) => {
      if (cancelled) return;
      // Filter out self and circular refs
      const filtered = result.tasks.filter((t) => {
        if (t.id === taskId) return false;
        // Check if candidate has a taskref subtask pointing back to us
        const hasCircularRef = t.subtasks.some(
          (s) => s.type === "taskref" && s.refTaskId === taskId,
        );
        return !hasCircularRef;
      });
      setCandidates(filtered);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const filtered = candidates.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (refId: string) => {
    onSelect(refId);
    onClose();
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      data-testid="taskref-modal-overlay"
    >
      <div className={styles.modal} ref={modalRef} data-testid="taskref-modal">
        <div className={styles.header}>Link a task</div>
        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="taskref-search-input"
        />
        {loading ? (
          <div className={styles.loading} data-testid="taskref-loading">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty} data-testid="taskref-empty">
            No matching tasks
          </div>
        ) : (
          <div className={styles.list} data-testid="taskref-list">
            {filtered.map((t) => (
              <button
                key={t.id}
                className={styles.item}
                onClick={() => handleSelect(t.id)}
                data-testid={`taskref-item-${t.id}`}
              >
                <span className={styles.itemTitle}>{t.title}</span>
                <span className={styles.statusBadge}>{t.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
