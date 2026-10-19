'use client'

import { useEffect, useRef, useState } from 'react'
import { FieldForm } from '@/components/builder/FieldForm'
import { LayerStack } from '@/components/builder/LayerStack'
import { LivePreview } from '@/components/builder/LivePreview'
import { validateFrameSize } from '@/lib/editor/frame-size'
import { buildPacketDefAt, type PacketDef } from '@/lib/emulator/packet-def'

interface Props {
  /** null means nothing is being edited. */
  editing: PacketDef | null
  onSave: (def: PacketDef) => void
  onCancel: () => void
}

export function PacketEditor({ editing, onSave, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // this effect only syncs the external <dialog> DOM API and never touches React state
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (editing && !dialog.open) {
      dialog.showModal()
    } else if (!editing && dialog.open) {
      dialog.close()
    }
  }, [editing])

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      /* id="editor": the dialog#editor selector in globals.css uses it to disable the hover
         scale animation (a dense form; same convention as the XMNT web app) */
      id="editor"
      /* Nearly full screen: three panes must fit, and a normal-size modal would squeeze out
         the right pane, whose live preview is the core of the whole design */
      className="m-auto h-[90vh] w-[90vw] max-w-none p-0"
    >
      {editing && (
        /* key makes React remount when the definition changes, naturally resetting the draft and
           selected layer. Resetting with setState in an effect causes cascading renders, which
           React advises against. */
        <EditorBody key={editing.id} initial={editing} onSave={onSave} onCancel={onCancel} />
      )}
    </dialog>
  )
}

interface BodyProps {
  initial: PacketDef
  onSave: (def: PacketDef) => void
  onCancel: () => void
}

/**
 * The editor itself.
 *
 * It holds a draft internally and sends it up only on Save; Cancel discards it
 * entirely, so changing one's mind halfway never pollutes the project state.
 */
function EditorBody({ initial, onSave, onCancel }: BodyProps) {
  const [draft, setDraft] = useState(initial)
  const [selected, setSelected] = useState(0)
  /**
   * The raw text typed into the frame-size field. null = untouched; show the actual built length.
   *
   * Without this it breaks: typing "1" instantly makes the payload pad-to/1, the packet
   * shrinks to just the headers, the field jumps to 74, and the following "28" turns
   * into "7428".
   */
  const [typedSize, setTypedSize] = useState<string | null>(null)

  // When the stack is dragged into an order that cannot be built (e.g. IPv4 becomes innermost
  // and the protocol cannot be inferred), building throws. Catch it and show why instead of
  // breaking the whole editor.
  let built: ReturnType<typeof buildPacketDefAt> | null = null
  let buildError: string | null = null
  try {
    built = buildPacketDefAt(draft, 0)
  } catch (e) {
    buildError = e instanceof Error ? e.message : String(e)
  }

  // When the stack cannot be built there is no payloadOffset to work from, so this field is
  // disabled and does not affect whether Save is disabled; that case is covered by the
  // existing "cannot build packet" message
  const sizeResult =
    built === null || typedSize === null ? null : validateFrameSize(typedSize, built.payloadOffset)
  const sizeInvalid = sizeResult !== null && !sizeResult.ok
  const displayedSize = typedSize ?? (built === null ? '' : String(built.bytes.length))

  return (
    <div className="flex h-full flex-col">
      {/* The outer box has the border and the inner one handles layout, so warnings can sit below without being cut by the border */}
      <div className="border-b border-current/10">
        <div className="flex items-center justify-between px-5 py-3">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="rounded bg-transparent px-2 py-1 text-lg font-medium outline-none
                       hover:bg-current/5 focus:bg-current/5"
          />
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 opacity-70">
              筆數
              <input
                type="number"
                min={1}
                value={draft.count}
                onChange={(e) =>
                  setDraft({ ...draft, count: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-20 rounded border border-current/20 bg-transparent px-2 py-1"
              />
            </label>

            <label className="flex items-center gap-2 opacity-70">
              封包大小
              <input
                type="number"
                min={built === null ? 1 : built.payloadOffset}
                value={displayedSize}
                disabled={built === null}
                onChange={(e) => {
                  const text = e.target.value
                  setTypedSize(text)
                  if (built === null) {
                    return
                  }
                  const result = validateFrameSize(text, built.payloadOffset)
                  if (result.ok) {
                    // only valid values reach the packet definition, so the field can never say
                    // 20 while the packet is actually 74
                    setDraft({
                      ...draft,
                      payload: { kind: 'pad-to', totalFrameSize: result.size, pattern: 'zero' },
                    })
                  }
                }}
                className={`w-24 rounded border bg-transparent px-2 py-1 disabled:opacity-40 ${
                  sizeInvalid ? 'border-warn' : 'border-current/20'
                }`}
              />
              <span className="text-xs opacity-60">bytes</span>
            </label>

            {/* Cancel is always available */}
            <button
              onClick={onCancel}
              className="rounded px-3 py-1.5 opacity-70 hover:bg-current/10"
            >
              取消
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={sizeInvalid}
              className="rounded bg-current/10 px-4 py-1.5 font-medium hover:bg-current/20
                         disabled:cursor-not-allowed disabled:opacity-40"
            >
              儲存
            </button>
          </div>
        </div>
        {/* Written as sizeResult !== null && !sizeResult.ok rather than using sizeInvalid above,
            because TypeScript cannot infer from sizeInvalid that sizeResult has a message */}
        {sizeResult !== null && !sizeResult.ok && (
          <p className="px-5 pb-2 text-sm text-warn">{sizeResult.message}</p>
        )}
      </div>

      <div className="grid flex-1 grid-cols-[16rem_1fr_22rem] gap-4 overflow-hidden p-4">
        <LayerStack def={draft} selected={selected} onSelect={setSelected} onChange={setDraft} />
        <div className="overflow-hidden">
          {buildError ? (
            <p className="text-sm text-warn">目前的堆疊組不出封包：{buildError}</p>
          ) : (
            <FieldForm
              def={draft}
              layerIndex={selected}
              resolvedValues={built?.layers[selected]?.values ?? {}}
              onChange={setDraft}
            />
          )}
        </div>
        <div className="overflow-hidden">
          {built ? (
            <LivePreview bytes={built.bytes} />
          ) : (
            <p className="text-sm opacity-50">組不出封包，沒有東西可以預覽</p>
          )}
        </div>
      </div>
    </div>
  )
}
