'use client'

import type { PacketTemplate } from '@/lib/editor/templates'
import { TEMPLATES } from '@/lib/editor/templates'

export function QuickAddBar({ onPick }: { onPick: (t: PacketTemplate) => void }) {
  const quick = TEMPLATES.filter((t) => t.quickAccess)

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-current/10 pt-4">
      <span className="text-sm opacity-60">新增封包類型：</span>
      {quick.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t)}
          className="rounded border border-current/20 px-3 py-1.5 text-sm transition hover:bg-current/5"
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}
