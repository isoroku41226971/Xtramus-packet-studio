'use client'

import { useEffect, useRef } from 'react'
import type { PacketTemplate } from '@/lib/editor/templates'
import { TEMPLATES } from '@/lib/editor/templates'

interface Props {
  open: boolean
  onPick: (template: PacketTemplate) => void
  onClose: () => void
}

export function TemplatePicker({ open, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(48rem,90vw)] p-0"
    >
      <div className="flex items-center justify-between border-b border-current/10 px-6 py-4">
        <h2 className="text-lg font-medium">選擇封包範本</h2>
        <button
          onClick={onClose}
          className="rounded px-3 py-1 text-sm opacity-60 transition hover:bg-current/10"
        >
          關閉
        </button>
      </div>

      <ul className="max-h-[60vh] overflow-y-auto p-4">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onPick(t)}
              /* List-row styling: no button border/background/hover scale, only the existing
                 faint hover:bg-current/5 background as feedback.
                 hover:[transform:none]: Tailwind's scale-* utilities set the separate `scale`
                 CSS property, which is unrelated to the `transform: scale(...)` used by the
                 site-wide base button style, so they don't cancel each other; overriding it
                 means setting transform itself. */
              className="w-full rounded-lg border-none bg-transparent px-4 py-3 text-left
                         transition hover:bg-current/5 hover:[transform:none]"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-sm opacity-60">{t.description}</div>
              <div className="mt-1 font-mono text-xs opacity-40">
                {t.layerIds.join(' / ')}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  )
}
