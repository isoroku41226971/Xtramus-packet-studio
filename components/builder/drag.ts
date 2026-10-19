/**
 * What is currently being dragged.
 *
 * The selection list uses kind to tell whether the incoming item is a packet
 * definition from the list (add) or one of its own entries (reorder). It is not
 * carried in dataTransfer because dataTransfer.getData() is readable only during
 * drop, not dragover, so the drop hint could not be decided.
 */
export type DragSource = { kind: 'candidate' | 'main'; id: string } | null
