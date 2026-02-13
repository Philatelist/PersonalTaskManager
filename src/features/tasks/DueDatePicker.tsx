import { useState } from "react";
import styles from "./DueDatePicker.module.css";

interface DueDatePickerProps {
  dueDate: string | null;
  onChange: (date: string | null) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return due < today;
}

export function DueDatePicker({ dueDate, onChange }: DueDatePickerProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      onChange(value);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={styles.container} data-testid="due-date-picker">
        <input
          type="date"
          className={styles.dateInput}
          defaultValue={dueDate ?? ""}
          onChange={handleDateChange}
          onBlur={() => setIsEditing(false)}
          autoFocus
          aria-label="Due date"
          data-testid="due-date-input"
        />
        {dueDate && (
          <button
            className={styles.clearButton}
            onClick={handleClear}
            aria-label="Clear due date"
            data-testid="due-date-clear"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="due-date-picker">
      <button
        className={`${styles.display} ${dueDate && isOverdue(dueDate) ? styles.overdue : ""} ${!dueDate ? styles.placeholder : ""}`}
        onClick={() => setIsEditing(true)}
        data-testid="due-date-display"
      >
        {dueDate ? formatDate(dueDate) : "No due date"}
      </button>
    </div>
  );
}
