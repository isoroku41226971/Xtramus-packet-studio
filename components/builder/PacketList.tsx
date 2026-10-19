'use client'

import { useProject } from '@/components/ProjectProvider'
import { summarizePacketDef } from '@/lib/editor/summary'

/** Styles shared by the seven header cells; only width and alignment differ. */
const TH = 'sticky top-0 z-10 border-b border-current/10 bg-background py-2 font-normal'

interface Props {
  onEdit: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

export function PacketList({ onEdit, onDragStart, onDragEnd }: Props) {
  const { state, dispatch } = useProject()

  if (state.packetDefs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-current/20 p-12 text-center">
        <p className="opacity-60">還沒有任何封包</p>
        <p className="mt-1 text-sm opacity-40">用下方的按鈕或「新增封包」開始</p>
      </div>
    )
  }

  return (
    <div className="max-h-[16rem] overflow-y-auto rounded-lg border border-current/10">
      <table className="w-full border-separate border-spacing-0 text-sm">
        {/* For the header to really cover the rows beneath, two things must both be right:
             1. sticky and the background go on th. Tailwind Preflight sets
                border-collapse: collapse on tables, and in that mode a thead background is not
                painted reliably
             2. **tr must not have opacity**. Opacity composites the whole subtree (including
                th's background) at that transparency, however solid th's own background is.
                To fade the text, put the opacity on a span around it; the span has no
                background, so only the text is affected */}
        <thead>
          <tr className="text-left">
            <th className={`${TH} w-10`}>
              <span className="opacity-60">#</span>
            </th>
            <th className={TH}>
              <span className="opacity-60">封包名稱</span>
            </th>
            <th className={TH}>
              <span className="opacity-60">協定摘要</span>
            </th>
            <th className={`${TH} w-20 text-right`}>
              <span className="opacity-60">筆數</span>
            </th>
            <th className={TH}>
              <span className="opacity-60">變化設定</span>
            </th>
            <th className={`${TH} w-28 text-right`}>
              <span className="opacity-60">大小 (Bytes)</span>
            </th>
            <th className={`${TH} w-32`} />
          </tr>
        </thead>
      <tbody>
        {state.packetDefs.map((def, index) => {
          const s = summarizePacketDef(def)
          return (
            <tr
              key={def.id}
              draggable
              onDragStart={() => onDragStart(def.id)}
              onDragEnd={onDragEnd}
              className="cursor-grab active:cursor-grabbing"
            >
              <td className="border-b border-current/5 py-2 opacity-50">{index + 1}</td>
              <td className="border-b border-current/5 py-2 font-medium">
                <button
                  onClick={() => onEdit(def.id)}
                  className="rounded px-1 text-left underline-offset-4 hover:underline"
                >
                  {def.name}
                </button>
              </td>
              <td className="border-b border-current/5 py-2 opacity-70">{s.protocolChain}</td>
              <td className="border-b border-current/5 py-2 text-right">{s.count}</td>
              <td className="border-b border-current/5 py-2 opacity-70">{s.variationLabel}</td>
              <td className="border-b border-current/5 py-2 text-right tabular-nums">
                {s.sizeBytes === null ? '—' : s.sizeBytes}
                {s.sizeVaries && <span className="opacity-50"> …</span>}
              </td>
              <td className="border-b border-current/5 py-2">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() =>
                      dispatch({
                        type: 'duplicate-packet',
                        id: def.id,
                        newId: crypto.randomUUID(),
                      })
                    }
                    className="rounded px-2 py-1 text-xs opacity-60 transition hover:bg-current/10 hover:opacity-100"
                  >
                    複製
                  </button>
                  <button
                    onClick={() => {
                      // compute before dispatch; afterwards those items are no longer in state
                      const affected = state.main.filter((i) => i.packetDefId === def.id).length
                      dispatch(
                        { type: 'remove-packet', id: def.id },
                        affected > 0
                          ? `已刪除「${def.name}」，連帶移除主選欄的 ${affected} 個項目`
                          : null,
                      )
                    }}
                    className="rounded px-2 py-1 text-xs opacity-60 transition hover:bg-current/10 hover:opacity-100"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
        </tbody>
      </table>
    </div>
  )
}
