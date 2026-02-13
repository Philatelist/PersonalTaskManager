import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./TaskCardContextMenu.module.css";

interface TaskCardContextMenuProps {
  position: { x: number; y: number };
  taskId: string;
  onMoveToTop: (taskId: string) => void;
  onMoveToBottom: (taskId: string) => void;
  onClose: () => void;
}

export function TaskCardContextMenu({
  position,
  taskId,
  onMoveToTop,
  onMoveToBottom,
  onClose,
}: TaskCardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp position to viewport
  const clampedStyle = useClampedPosition(position, menuRef);

  // Dismiss on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleMoveToTop() {
    onClose();
    onMoveToTop(taskId);
  }

  function handleMoveToBottom() {
    onClose();
    onMoveToBottom(taskId);
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={clampedStyle}
      data-testid="context-menu"
    >
      <button
        className={styles.menuItem}
        onClick={handleMoveToTop}
        data-testid="context-menu-top"
      >
        Move to Top
      </button>
      <button
        className={styles.menuItem}
        onClick={handleMoveToBottom}
        data-testid="context-menu-bottom"
      >
        Move to Bottom
      </button>
    </div>,
    document.body,
  );
}

function useClampedPosition(
  position: { x: number; y: number },
  menuRef: React.RefObject<HTMLDivElement | null>,
) {
  // Start at the click position; after mount we'll measure and clamp
  // For SSR/test safety, fall back to the raw position
  const menuEl = menuRef.current;
  let left = position.x;
  let top = position.y;

  if (menuEl) {
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + rect.width > vw) {
      left = vw - rect.width;
    }
    if (top + rect.height > vh) {
      top = vh - rect.height;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;
  }

  return { left, top };
}
