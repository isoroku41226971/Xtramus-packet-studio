'use client'

import { useEffect, useRef, useState } from 'react'
import { downloadBytes, safeFilename } from '@/components/viewer/download'
import { useProject } from '@/components/ProjectProvider'
import { summarizeSequence } from '@/lib/editor/summary'
import { sequenceToCaptureFile } from '@/lib/emulator/export'
import type { EmulatedSequence } from '@/lib/emulator/sequence'
import { decodePacket } from '@/lib/packet/decode'
import type { CaptureFormat } from '@/lib/pcap'
import { writeCapture } from '@/lib/pcap'
import { generateScapyScript, type ScapyPacket } from '@/lib/scapy/generate'

/** Export formats. 'py' is not a capture format, so it is added separately. */
type ExportFormat = CaptureFormat | 'py'

export function ExportBar({ sequence }: { sequence: EmulatedSequence }) {
  const { state } = useProject()
  const { totalPackets, totalDurationMs } = summarizeSequence(state)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Take only one loop of packets; the loop count goes to sendp's count argument.
   *
   * perLoop must not be computed as length / loopCount: when loopCount is 0, length is
   * also 0 and the result would be NaN.
   */
  function buildScript(name: string): string {
    const loopCount = Math.max(0, state.style.loopCount)
    const perLoop = loopCount === 0 ? 0 : sequence.length / loopCount
    const packets: ScapyPacket[] = []
    for (let i = 0; i < perLoop; i++) {
      const bytes = sequence.at(i).bytes
      packets.push({ decoded: decodePacket(bytes), bytes })
    }
    return generateScapyScript(packets, {
      projectName: name,
      intervalMs: state.style.intervalMs,
      loopCount,
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="opacity-60">
          共 {totalPackets} 筆 · 間隔 {state.style.intervalMs} ms · 總時長{' '}
          {(totalDurationMs / 1000).toFixed(2)} s
        </span>
        <button
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
          disabled={totalPackets === 0}
          className="ml-auto rounded bg-current/10 px-4 py-2 font-medium transition
                     hover:bg-current/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          匯出
        </button>
      </div>

      {error && (
        <p className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          匯出失敗：{error}
        </p>
      )}

      <ExportDialog
        open={open}
        defaultName={state.name}
        onCancel={() => setOpen(false)}
        onExport={(name, format) => {
          try {
            if (format === 'py') {
              downloadBytes(
                new TextEncoder().encode(buildScript(name)),
                safeFilename(name, 'py'),
                'text/x-python',
              )
              setError(null)
              setOpen(false)
              return
            }
            // the base time is taken here so the lib layer stays pure
            const file = sequenceToCaptureFile(sequence, Date.now() * 1000)
            downloadBytes(writeCapture(file, format), safeFilename(name, format))
            setError(null)
          } catch (e) {
            // abort and explain what went wrong instead of writing half a file
            setError(e instanceof Error ? e.message : String(e))
          }
          setOpen(false)
        }}
      />
    </div>
  )
}

function ExportDialog({
  open,
  defaultName,
  onCancel,
  onExport,
}: {
  open: boolean
  defaultName: string
  onCancel: () => void
  onExport: (name: string, format: ExportFormat) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  // this effect only syncs the external <dialog> DOM API and never touches React state
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
      onClose={onCancel}
      className="m-auto w-[min(28rem,90vw)] p-0"
    >
      {/* key remounts the dialog on every open so the file name and format reset to their defaults.
          Resetting with setState in an effect causes cascading renders, which React advises against. */}
      {open && (
        <ExportForm key={defaultName} defaultName={defaultName} onCancel={onCancel} onExport={onExport} />
      )}
    </dialog>
  )
}

function ExportForm({
  defaultName,
  onCancel,
  onExport,
}: {
  defaultName: string
  onCancel: () => void
  onExport: (name: string, format: ExportFormat) => void
}) {
  const [name, setName] = useState(defaultName)
  const [format, setFormat] = useState<ExportFormat>('pcap')

  return (
    <div className="flex flex-col gap-4 p-5">
      <h2 className="text-lg font-medium">匯出封包</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">檔案名稱</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-current/20 bg-transparent px-2 py-1"
        />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="opacity-70">格式</legend>
        <div className="mt-1 flex gap-4">
          {(['pcap', 'pcapng', 'py'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2">
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
              />
              {f === 'py' ? 'Python (Scapy)' : f}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="dialog-actions">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm opacity-70 hover:bg-current/10"
        >
          取消
        </button>
        <button
          onClick={() => onExport(name, format)}
          className="rounded bg-current/10 px-4 py-1.5 text-sm font-medium hover:bg-current/20"
        >
          匯出
        </button>
      </div>
    </div>
  )
}
