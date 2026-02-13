import type { RefObject } from "react";
import styles from "./MarkdownToolbar.module.css";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onValueChange: (newValue: string) => void;
}

function getLineStart(text: string, pos: number): number {
  const idx = text.lastIndexOf("\n", pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

export function MarkdownToolbar({
  textareaRef,
  onValueChange,
}: MarkdownToolbarProps) {
  function applyWrap(before: string, after: string, placeholder: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.slice(start, end);
    const text = selected || placeholder;
    const newValue =
      value.slice(0, start) + before + text + after + value.slice(end);
    onValueChange(newValue);
    // Restore cursor: select the inserted/wrapped text
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + text.length;
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function applyLinePrefix(prefix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, value } = ta;
    const lineStart = getLineStart(value, start);
    const newValue =
      value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onValueChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(
        start + prefix.length,
        start + prefix.length,
      );
    });
  }

  function handleBold() {
    applyWrap("**", "**", "bold text");
  }

  function handleItalic() {
    applyWrap("*", "*", "italic text");
  }

  function handleHeading() {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, value } = ta;
    const lineStart = getLineStart(value, start);
    // Check current heading level
    const lineText = value.slice(lineStart);
    const match = lineText.match(/^(#{1,3}) /);
    if (match) {
      const level = match[1].length;
      if (level < 3) {
        // Add one more #
        const newValue =
          value.slice(0, lineStart) + "#" + value.slice(lineStart);
        onValueChange(newValue);
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(start + 1, start + 1);
        });
      } else {
        // Cycle back: remove all ### and space
        const newValue =
          value.slice(0, lineStart) +
          value.slice(lineStart + match[0].length);
        onValueChange(newValue);
        requestAnimationFrame(() => {
          ta.focus();
          const newPos = Math.max(lineStart, start - match[0].length);
          ta.setSelectionRange(newPos, newPos);
        });
      }
    } else {
      applyLinePrefix("# ");
    }
  }

  function handleBullet() {
    applyLinePrefix("- ");
  }

  function handleNumbered() {
    applyLinePrefix("1. ");
  }

  function handleCode() {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.slice(start, end);
    if (selected.includes("\n")) {
      // Multi-line: wrap in triple backticks
      applyWrap("\n```\n", "\n```\n", "code");
    } else {
      applyWrap("`", "`", "code");
    }
  }

  function handleLink() {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.slice(start, end);
    const linkText = selected || "link text";
    const newValue =
      value.slice(0, start) + `[${linkText}](url)` + value.slice(end);
    onValueChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      // Select "url" for easy replacement
      const urlStart = start + linkText.length + 3; // [text](
      ta.setSelectionRange(urlStart, urlStart + 3);
    });
  }

  return (
    <div
      className={styles.toolbar}
      data-testid="markdown-toolbar"
      // Prevent blur on textarea when clicking toolbar buttons
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className={styles.button}
        onClick={handleBold}
        aria-label="Bold"
        data-testid="toolbar-bold"
      >
        B
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleItalic}
        aria-label="Italic"
        data-testid="toolbar-italic"
      >
        I
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleHeading}
        aria-label="Heading"
        data-testid="toolbar-heading"
      >
        H
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleBullet}
        aria-label="Bullet List"
        data-testid="toolbar-bullet"
      >
        &bull;
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleNumbered}
        aria-label="Numbered List"
        data-testid="toolbar-numbered"
      >
        1.
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleCode}
        aria-label="Code"
        data-testid="toolbar-code"
      >
        &lt;/&gt;
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={handleLink}
        aria-label="Link"
        data-testid="toolbar-link"
      >
        &#128279;
      </button>
    </div>
  );
}
