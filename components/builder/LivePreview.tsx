'use client'

import { buildDecodeTree, hexDump } from '@/lib/editor/preview'

export function LivePreview({ bytes }: { bytes: Uint8Array }) {
  const lines = hexDump(bytes)
  const tree = buildDecodeTree(bytes)

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 text-xs opacity-60">解碼樹</div>
        <div className="overflow-y-auto font-mono text-xs leading-relaxed">
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 text-xs opacity-60">Hex（{bytes.length} bytes）</div>
        <div className="overflow-y-auto font-mono text-xs leading-relaxed">
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
