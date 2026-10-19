/**
 * Keyboard navigation for the custom dropdown. Pure functions, no DOM.
 * The wrap-around navigation (ArrowDown on the last item returns to the first) is
 * taken unchanged from the XMNT web app's ui/listbox-nav.js.
 */

export function nextIndex(current: number, key: string, count: number): number {
  if (count === 0) return -1
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return current
  }
}

/** These key groups are kept separate on purpose; Escape and Enter express different intents. */
export const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown', 'ArrowUp'])
export const CLOSE_KEYS = new Set(['Escape'])
export const SELECT_KEYS = new Set(['Enter', ' '])
