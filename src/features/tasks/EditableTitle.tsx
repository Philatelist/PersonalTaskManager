import { useState, useRef, useEffect } from "react";
import styles from "./EditableTitle.module.css";

interface EditableTitleProps {
  value: string;
  onSave: (newTitle: string) => Promise<void>;
}

export function EditableTitle({ value, onSave }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes (e.g. after refresh)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus and select on entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleClick() {
    setEditValue(value);
    setIsEditing(true);
  }

  async function handleCommit() {
    const trimmed = editValue.trim();
    setIsEditing(false);
    if (!trimmed) {
      setEditValue(value);
      return;
    }
    if (trimmed !== value) {
      await onSave(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        data-testid="editable-title-input"
      />
    );
  }

  return (
    <h1
      className={styles.heading}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
      tabIndex={0}
      role="button"
      aria-label="Edit task title"
      data-testid="task-title"
    >
      {value}
    </h1>
  );
}
