import {
  KeyboardCode,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Custom coordinate getter that only responds to Alt+ArrowUp and Alt+ArrowDown.
 * All other keys (including plain arrows) are ignored.
 */
export const altArrowCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  if (
    !event.altKey ||
    (event.code !== KeyboardCode.Up && event.code !== KeyboardCode.Down)
  ) {
    return undefined;
  }

  event.preventDefault();
  return sortableKeyboardCoordinates(event, args);
};
