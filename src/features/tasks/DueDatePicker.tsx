import { useState } from "react";
import { getUrgency, formatOverdueText } from "./urgency";
import styles from "./DueDatePicker.module.css";

interface DueDatePickerProps {
  dueDate: string | null;
  onChange: (date: string | null) => void;
  status?: string;
  readOnly?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DueDatePicker({ dueDate, onChange, status, readOnly }: DueDatePickerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const urgency = getUrgency(dueDate, status ?? "active");
  const overdueText = urgency ? formatOverdueText(urgency.daysRemaining) : null;

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
      {urgency && (
        <span
          className={styles.urgencyDot}
          style={{ backgroundColor: urgency.color }}
          data-testid="urgency-dot"
        />
      )}
      <button
        className={`${styles.display} ${urgency?.tier === "overdue" ? styles.overdue : ""} ${!dueDate ? styles.placeholder : ""}`}
        onClick={() => { if (!readOnly) setIsEditing(true); }}
        data-testid="due-date-display"
      >
        {dueDate ? formatDate(dueDate) : "No due date"}
      </button>
      {overdueText && (
        <span className={styles.overdueText} data-testid="detail-overdue-text">
          {overdueText}
        </span>
      )}
    </div>
  );
}
