'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { DragSource } from '@/components/builder/drag'
import { ImportButton } from '@/components/builder/ImportButton'
import { MainSlot } from '@/components/builder/MainSlot'
import { PacketEditor } from '@/components/builder/PacketEditor'
import { PacketList } from '@/components/builder/PacketList'
import { QuickAddBar } from '@/components/builder/QuickAddBar'
import { StyleControls } from '@/components/builder/StyleControls'
import { TemplatePicker } from '@/components/builder/TemplatePicker'
import { useProject } from '@/components/ProjectProvider'
import { SaveBar } from '@/components/SaveBar'
import { ExportBar } from '@/components/viewer/ExportBar'
import { PacketDetail } from '@/components/viewer/PacketDetail'
import { PacketTable } from '@/components/viewer/PacketTable'
import { createPacketDefFromTemplate, type PacketTemplate } from '@/lib/editor/templates'
import { createSequence } from '@/lib/emulator/sequence'

/**
 * Server-side rendering is turned off. ProjectProvider's initial state reads
 * sessionStorage, which returns null on the server but has data in the browser, so
 * the first renders would differ and React would throw a hydration error. This page
 * is an interactive tool that needs no SEO, so not rendering it on the server is the
 * cleanest fix.
 *
 * `dynamic(..., { ssr: false })` can only be used in a Client Component, and this
 * file already has 'use client'.
 */
const ProjectProvider = dynamic(
  () => import('@/components/ProjectProvider').then((m) => m.ProjectProvider),
  { ssr: false },
)

type Tab = 'build' | 'preview'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'build', label: '1. 建立與選擇封包' },
  { id: 'preview', label: '2. 預覽封包' },
]

function StudioShell() {
  const [tab, setTab] = useState<Tab>('build')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragSource>(null)
  const [selectedPacket, setSelectedPacket] = useState<number | null>(null)
  const { state, dispatch, notice } = useProject()
  const editing = state.packetDefs.find((d) => d.id === editingId) ?? null

  // Rebuilt on every render. createSequence is lazy: creating it only does arithmetic
  // and builds no packets.
  const sequence = createSequence(
    state.main,
    new Map(state.packetDefs.map((d) => [d.id, d])),
    state.style,
  )

  function addFromTemplate(template: PacketTemplate) {
    dispatch({
      type: 'add-packet',
      def: createPacketDefFromTemplate(template, crypto.randomUUID()),
    })
    setPickerOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[rgba(127,127,127,0.3)] px-6 py-3">
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab ${tab === t.id ? 'on' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <SaveBar />
      </header>

      <main className="flex-1 p-6">
        {tab === 'build' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="actions">
                <button onClick={() => setPickerOpen(true)} className="primary">
                  ＋ 新增封包
                </button>
                <ImportButton />
              </div>
            </div>
            {notice && (
              <p className="rounded border border-warn/40 bg-warn/5 px-3 py-2 text-sm text-warn">
                {notice}
              </p>
            )}
            <PacketList
              onEdit={setEditingId}
              onDragStart={(id) => setDrag({ kind: 'candidate', id })}
              onDragEnd={() => setDrag(null)}
            />
            <QuickAddBar onPick={addFromTemplate} />

            <div className="divider">
              <button
                onClick={() => {
                  // no deduplication: the selection list allows the same definition several
                  // times, and deduplicating would make "click twice" behave unpredictably
                  for (const d of state.packetDefs) {
                    dispatch({
                      type: 'add-to-main',
                      packetDefId: d.id,
                      itemId: crypto.randomUUID(),
                    })
                  }
                }}
                disabled={state.packetDefs.length === 0}
                className="primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden>↓</span> 全部加入 <span aria-hidden>↓</span>
              </button>
            </div>

            <MainSlot
              drag={drag}
              onAdd={(packetDefId) =>
                dispatch({ type: 'add-to-main', packetDefId, itemId: crypto.randomUUID() })
              }
              onDragStartItem={(itemId) => setDrag({ kind: 'main', id: itemId })}
              onDragEnd={() => setDrag(null)}
            />
            <StyleControls />

            {/* After this tab the next step is the preview, so this saves going back up to the tabs.
                self-end: the parent is a vertical flex container, so without it the button would
                stretch to the full width. Styled like the add-packet button above */}
            <button onClick={() => setTab('preview')} className="self-end primary">
              預覽封包 <span aria-hidden>→</span>
            </button>
          </div>
        )}
        {tab === 'preview' && (
          <div className="flex flex-col gap-4">
            <ExportBar sequence={sequence} />
            {sequence.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-neutral p-12 text-center opacity-50">
                主選欄還沒有封包，先回上一個分頁拖幾個下來
              </p>
            ) : (
              <>
                <PacketTable
                  sequence={sequence}
                  selected={selectedPacket}
                  onSelect={setSelectedPacket}
                />
                {/* The index may be out of range: if the user selected row 500, went back and
                    shortened the sequence, the old index is invalid on return and at() would
                    throw RangeError */}
                {selectedPacket !== null && selectedPacket < sequence.length && (
                  <PacketDetail bytes={sequence.at(selectedPacket).bytes} />
                )}
              </>
            )}
          </div>
        )}
      </main>

      <TemplatePicker
        open={pickerOpen}
        onPick={addFromTemplate}
        onClose={() => setPickerOpen(false)}
      />

      <PacketEditor
        editing={editing}
        onSave={(def) => {
          dispatch({ type: 'update-packet', def })
          setEditingId(null)
        }}
        onCancel={() => setEditingId(null)}
      />
    </div>
  )
}

export default function StudioPage() {
  return (
    <ProjectProvider>
      <StudioShell />
    </ProjectProvider>
  )
}
