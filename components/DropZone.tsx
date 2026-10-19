'use client'

import { useState, type DragEvent } from 'react'
import { readDroppedFiles, type DroppedFile } from '@/components/file-handle'

/** Whether the dragged content includes files. */
function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

/**
 * An area files can be dropped onto.
 *
 * The three HTML5 drag-and-drop pitfalls are handled once here so callers don't each
 * repeat them:
 *   1. dragover must call preventDefault(), or drop never fires
 *   2. highlight only when files are actually being dragged, or dragging a packet row
 *      over it would light it up too
 *   3. child elements fire dragleave and make the highlight flicker, so everything
 *      inside is pointer-events-none
 */
export function DropZone({
  label,
  onDrop,
}: {
  label: string
  onDrop: (entries: DroppedFile[]) => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        if (!hasFiles(e)) {
          return
        }
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) {
          return
        }
        e.preventDefault()
        setOver(false)
        void readDroppedFiles(e.dataTransfer).then((entries) => {
          // do nothing when there are no files, so callers never handle an empty array
          if (entries.length > 0) {
            onDrop(entries)
          }
        })
      }}
      className={`rounded-lg border border-dashed px-4 py-3 text-center text-sm transition-opacity duration-200 ${
        over
          ? 'opacity-100 border-brand bg-brand/[8%]'
          : 'border-[rgba(127,127,127,0.4)] opacity-60'
      }`}
    >
      <span className="pointer-events-none inline-flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        {label}
      </span>
    </div>
  )
}
