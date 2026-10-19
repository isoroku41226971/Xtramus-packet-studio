'use client'

import { useRef, useState } from 'react'
import { DropZone } from '@/components/DropZone'
import { useProject } from '@/components/ProjectProvider'
import { capturedToPacketDef } from '@/lib/editor/import'
import type { CaptureFile } from '@/lib/pcap'
import { readCapture } from '@/lib/pcap'

export function ImportButton() {
  const { dispatch } = useProject()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: CaptureFile; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File) {
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      // read it first to see how many packets there are, without touching the list yet
      setPending({ file: readCapture(bytes), name: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function confirm() {
    if (!pending) {
      return
    }
    for (const [i, captured] of pending.file.packets.entries()) {
      dispatch({
        type: 'add-packet',
        def: capturedToPacketDef(captured, crypto.randomUUID(), `${pending.name} #${i + 1}`),
      })
    }
    setPending(null)
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      {/* items-start: the drop zone is taller than the button, so centering would leave the
          import button sitting lower than the add-packet button next to it */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          /* A light secondary button using the home page card palette (bg-card-primary),
             visually below the primary add-packet action (solid brand color) */
          className="rounded border-none bg-card-primary px-4 py-2 text-sm font-medium
                     text-brand-deep transition hover:bg-card-primary-hover"
        >
          匯入封包
        </button>
        <div className="flex-1">
          <DropZone
            label="或拖曳 .pcap / .pcapng 檔案到此處"
            onDrop={(entries) => void pick(entries[0].file)}
          />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pcap,.pcapng"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void pick(file)
          }
          // clear it so the same file can be picked twice in a row
          e.target.value = ''
        }}
      />

      {error && (
        <p className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          讀不進來：{error}
        </p>
      )}

      {pending && (
        <div className="rounded border border-warn/40 bg-warn/5 px-3 py-2 text-sm">
          <p>
            「{pending.name}」有 <strong>{pending.file.packets.length}</strong> 筆封包，全部匯入？
          </p>
          {pending.file.warnings.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs opacity-70">
              {pending.file.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={confirm}
              className="rounded bg-current/10 px-3 py-1 text-sm font-medium hover:bg-current/20"
            >
              匯入
            </button>
            <button
              onClick={() => setPending(null)}
              className="rounded px-3 py-1 text-sm opacity-70 hover:bg-current/10"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
