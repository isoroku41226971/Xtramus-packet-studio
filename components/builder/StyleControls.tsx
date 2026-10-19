'use client'

import { useProject } from '@/components/ProjectProvider'
import { summarizeSequence } from '@/lib/editor/summary'

export function StyleControls() {
  const { state, dispatch } = useProject()
  const { totalPackets, totalDurationMs } = summarizeSequence(state)

  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-current/10 pt-3 text-sm">
      <label className="flex items-center gap-2 opacity-70">
        間隔
        <input
          type="number"
          min={0}
          value={state.style.intervalMs}
          onChange={(e) =>
            dispatch({
              type: 'set-style',
              style: { intervalMs: Math.max(0, Number(e.target.value) || 0) },
            })
          }
          className="w-20 rounded border border-current/20 bg-transparent px-2 py-1"
        />
        ms
      </label>

      <label className="flex items-center gap-2 opacity-70">
        循環
        <input
          type="number"
          min={1}
          value={state.style.loopCount}
          onChange={(e) =>
            dispatch({
              type: 'set-style',
              style: { loopCount: Math.max(1, Number(e.target.value) || 1) },
            })
          }
          className="w-16 rounded border border-current/20 bg-transparent px-2 py-1"
        />
        次
      </label>

      <span className="ml-auto tabular-nums opacity-60">
        總筆數 {totalPackets} · 總時長 {(totalDurationMs / 1000).toFixed(2)} s
      </span>
    </div>
  )
}
