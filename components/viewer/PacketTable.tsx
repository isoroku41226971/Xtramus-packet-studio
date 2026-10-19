'use client'

import { useState } from 'react'
import type { RowSummary } from '@/lib/editor/preview'
import { summarizeRow } from '@/lib/editor/preview'
import type { EmulatedSequence } from '@/lib/emulator/sequence'

const ROW_HEIGHT = 28
const VIEWPORT_HEIGHT = 420
/** Extra rows rendered above and below, so new rows are already drawn before they scroll into view. */
const OVERSCAN = 5

interface Props {
  sequence: EmulatedSequence
  selected: number | null
  onSelect: (index: number) => void
}

export function PacketTable({ sequence, selected, onSelect }: Props) {
  const [scrollTop, setScrollTop] = useState(0)
  const total = sequence.length

  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(total, start + visibleCount + OVERSCAN * 2)

  const rows: number[] = []
  for (let i = start; i < end; i++) {
    rows.push(i)
  }

  return (
    <div className="rounded-lg border border-current/15">
      <div className="flex border-b border-current/10 px-3 py-2 text-xs opacity-60">
        <span className="w-14 shrink-0">#</span>
        <span className="w-28 shrink-0">Time</span>
        <span className="w-44 shrink-0">Source</span>
        <span className="w-44 shrink-0">Destination</span>
        <span className="w-24 shrink-0">Protocol</span>
        <span className="w-20 shrink-0 text-right">Length</span>
        <span className="flex-1 pl-4">Info</span>
      </div>

      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ height: VIEWPORT_HEIGHT }}
        className="overflow-y-auto"
      >
        {/* Spacer element: makes the scrollbar reflect the total packet count even though only a few dozen rows render */}
        <div style={{ height: total * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {rows.map((i) => (
              <PacketRow
                key={i}
                index={i}
                sequence={sequence}
                selected={selected === i}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PacketRow({
  index,
  sequence,
  selected,
  onSelect,
}: {
  index: number
  sequence: EmulatedSequence
  selected: boolean
  onSelect: (index: number) => void
}) {
  // one packet that cannot be built must not blank the whole list; only that row shows an error.
  //
  // Computation is kept separate from building JSX: try/catch wraps only at() and
  // summarizeRow(), which can actually throw. Wrapping the JSX too would be flagged by
  // react-hooks/error-boundaries, and rightly so: try/catch cannot catch render-time errors;
  // the exceptions caught here simply happen before any JSX is built.
  let data: { time: string; row: RowSummary } | null = null
  let error: string | null = null
  try {
    const packet = sequence.at(index)
    data = {
      time: (packet.timeUs / 1_000_000).toFixed(6),
      row: summarizeRow(packet.bytes),
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return (
    <div
      onClick={() => onSelect(index)}
      style={{ height: ROW_HEIGHT }}
      className={`flex cursor-pointer items-center px-3 font-mono text-xs transition ${
        selected ? 'bg-brand/[15%]' : 'hover:bg-current/5'
      }`}
    >
      {data === null ? (
        <span className="text-warn">
          第 {index + 1} 筆組不出來：{error}
        </span>
      ) : (
        <>
          <span className="w-14 shrink-0 opacity-50">{index + 1}</span>
          <span className="w-28 shrink-0 tabular-nums opacity-70">{data.time}</span>
          <span className="w-44 shrink-0 truncate">{data.row.source}</span>
          <span className="w-44 shrink-0 truncate">{data.row.destination}</span>
          <span className="w-24 shrink-0">{data.row.protocol}</span>
          <span className="w-20 shrink-0 text-right tabular-nums">{data.row.length}</span>
          <span className="flex-1 truncate pl-4 opacity-70">{data.row.info}</span>
        </>
      )}
    </div>
  )
}
