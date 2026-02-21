import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { taskList } from "./task-service";
import type { Task } from "./types";
import styles from "./DependencySearchModal.module.css";

interface DependencySearchModalProps {
  taskId: string;
  existingIds: string[];
  onSelect: (selectedTaskId: string) => void;
  onClose: () => void;
}

export function DependencySearchModal({
  taskId,
  existingIds,
  onSelect,
  onClose,
}: DependencySearchModalProps) {
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    taskList({ statusFilter: "active" }).then((result) => {
      if (cancelled) return;
      const existingSet = new Set(existingIds);
      const filtered = result.tasks.filter((t) => {
        if (t.id === taskId) return false;
        if (existingSet.has(t.id)) return false;
        return true;
      });
      setCandidates(filtered);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, existingIds]);

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

  const handleSelect = (selectedId: string) => {
    onSelect(selectedId);
    onClose();
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      data-testid="dep-search-overlay"
    >
      <div className={styles.modal} ref={modalRef} data-testid="dep-search-modal">
        <div className={styles.header}>Select a task</div>
        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="dep-search-input"
        />
        {loading ? (
          <div className={styles.loading} data-testid="dep-search-loading">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty} data-testid="dep-search-empty">
            No matching tasks
          </div>
        ) : (
          <div className={styles.list} data-testid="dep-search-list">
            {filtered.map((t) => (
              <button
                key={t.id}
                className={styles.item}
                onClick={() => handleSelect(t.id)}
                data-testid={`dep-search-item-${t.id}`}
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
