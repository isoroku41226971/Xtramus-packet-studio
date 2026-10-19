'use client'

import { buildDecodeTree, hexDump } from '@/lib/editor/preview'

export function PacketDetail({ bytes }: { bytes: Uint8Array }) {
  const tree = buildDecodeTree(bytes)
  const lines = hexDump(bytes)

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-current/15 p-3">
        <div className="mb-2 text-xs opacity-60">解碼樹</div>
        <div className="max-h-72 overflow-y-auto font-mono text-xs leading-relaxed">
          {tree.map((node, i) => (
            <div key={i}>
              <div className="opacity-90">{node.label}</div>
              {node.children.map((child, j) => (
                <div key={j} className="pl-4 opacity-60">
                  {child.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-current/15 p-3">
        <div className="mb-2 text-xs opacity-60">Hex（{bytes.length} bytes）</div>
        <div className="max-h-72 overflow-y-auto font-mono text-xs leading-relaxed">
          {lines.map((line) => (
            <div key={line.offset} className="whitespace-pre">
              <span className="opacity-40">{line.offset.toString(16).padStart(4, '0')}</span>
              {'  '}
              <span>{line.hex.map((h) => (h === '' ? '  ' : h)).join(' ')}</span>
              {'  '}
              <span className="opacity-50">{line.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
