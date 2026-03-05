import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { MarkdownToolbar } from "./MarkdownToolbar";
import styles from "./MarkdownEditor.module.css";
import type { ComponentPropsWithoutRef } from "react";

function SafeLink(props: ComponentPropsWithoutRef<"a">) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  );
}

interface MarkdownEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  readOnly,
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep valueRef in sync when not editing
  useEffect(() => {
    if (!isEditing) {
      valueRef.current = value;
    }
  }, [value, isEditing]);

  // Auto-focus and auto-grow on entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      autoGrow(textareaRef.current);
    }
  }, [isEditing]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    valueRef.current = newValue;
    onChange(newValue);
    autoGrow(e.target);
  }

  const handleValueChange = useCallback(
    (newValue: string) => {
      valueRef.current = newValue;
      onChange(newValue);
      if (textareaRef.current) {
        textareaRef.current.value = newValue;
        autoGrow(textareaRef.current);
      }
    },
    [onChange],
  );

  function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    // Check if the new focus target is within our container (e.g. toolbar)
    const related = e.relatedTarget as Node | null;
    if (containerRef.current && related && containerRef.current.contains(related)) {
      return; // Stay in edit mode
    }
    setIsEditing(false);
    onBlur?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setIsEditing(false);
      onBlur?.();
    }
  }

  function enterEdit() {
    if (readOnly) return;
    setIsEditing(true);
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className={styles.editorContainer} data-testid="markdown-editor">
        <MarkdownToolbar
          textareaRef={textareaRef}
          onValueChange={handleValueChange}
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          defaultValue={valueRef.current}
          onChange={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          data-testid="markdown-textarea"
        />
      </div>
    );
  }

  if (!value) {
    return (
      <div
        className={styles.placeholder}
        onClick={enterEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") enterEdit();
        }}
        tabIndex={0}
        role="button"
        aria-label="Add notes"
        data-testid="markdown-placeholder"
      >
        Click to add notes...
      </div>
    );
  }

  return (
    <div
      className={styles.rendered}
      onClick={enterEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") enterEdit();
      }}
      tabIndex={0}
      role="button"
      aria-label="Edit notes"
      data-testid="markdown-rendered"
    >
      <Markdown
        rehypePlugins={[rehypeSanitize]}
        components={{ a: SafeLink }}
      >
        {value}
      </Markdown>
    </div>
  );
}
