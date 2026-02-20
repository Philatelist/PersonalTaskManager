import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { taskCreate } from "./task-service";
import styles from "./CreateTaskModal.module.css";

interface CreateTaskModalProps {
  onCreated: () => void;
  onClose: () => void;
}

export function CreateTaskModal({ onCreated, onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty");
      return;
    }
    setSubmitting(true);
    try {
      await taskCreate(trimmed);
      onCreated();
      onClose();
    } catch {
      setError("Failed to create task");
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !submitting) {
      handleSubmit();
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      data-testid="create-task-overlay"
    >
      <div className={styles.modal} ref={modalRef} data-testid="create-task-modal">
        <div className={styles.header}>New task</div>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          data-testid="create-task-input"
        />
        {error && (
          <div className={styles.error} data-testid="create-task-error">
            {error}
          </div>
        )}
        <div className={styles.actions}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            data-testid="create-task-cancel"
          >
            Cancel
          </button>
          <button
            className={styles.createButton}
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="create-task-submit"
          >
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
