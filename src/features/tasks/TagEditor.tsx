import { useState } from "react";
import styles from "./TagEditor.module.css";

interface TagEditorProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

export function TagEditor({ tags, onAdd, onRemove }: TagEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const sortedTags = [...tags].sort();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        onAdd(trimmed);
        setInputValue("");
      }
    }
  };

  return (
    <div className={styles.container} data-testid="tag-editor">
      {sortedTags.length > 0 && (
        <div className={styles.chips} data-testid="tag-chips">
          {sortedTags.map((tag) => (
            <span key={tag} className={styles.chip} data-testid={`tag-chip-${tag}`}>
              {tag}
              <button
                className={styles.removeButton}
                onClick={() => onRemove(tag)}
                aria-label={`Remove tag ${tag}`}
                data-testid={`tag-remove-${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={styles.input}
        type="text"
        placeholder="Add tag..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Add tag"
        data-testid="tag-input"
      />
    </div>
  );
}
