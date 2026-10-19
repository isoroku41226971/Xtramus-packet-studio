import { decodePacket } from '../packet/decode'
import { findLayer } from '../packet/registry'

export interface HexDumpLine {
  offset: number
  /** Fixed-length array; missing positions are empty strings, not '00'. */
  hex: string[]
  ascii: string
}

export interface DecodeTreeNode {
  label: string
  children: DecodeTreeNode[]
  /** The byte range this node covers, for highlighting the hex on click. */
  offset?: number
  length?: number
}

const PRINTABLE_MIN = 0x20
const PRINTABLE_MAX = 0x7e

export function hexDump(bytes: Uint8Array, bytesPerLine = 16): HexDumpLine[] {
  const lines: HexDumpLine[] = []
  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const slice = bytes.slice(offset, offset + bytesPerLine)
    const hex: string[] = []
    let ascii = ''
    for (let i = 0; i < bytesPerLine; i++) {
      if (i < slice.length) {
        hex.push(slice[i].toString(16).padStart(2, '0'))
        ascii +=
          slice[i] >= PRINTABLE_MIN && slice[i] <= PRINTABLE_MAX
            ? String.fromCharCode(slice[i])
            : '.'
      } else {
        // pad with empty strings, not '00': there is no data at that position, not data equal to zero
        hex.push('')
      }
    }
    lines.push({ offset, hex, ascii })
  }
  return lines
}

/**
 * Decode bytes into a Wireshark-style field tree.
 *
 * **It takes bytes, not the model.** This is a deliberate self-check: the right
 * pane shows the bytes about to be exported, decoded again, so a wrong checksum
 * or length shows up right here.
 */
export function buildDecodeTree(bytes: Uint8Array): DecodeTreeNode[] {
  const nodes: DecodeTreeNode[] = [
    {
      label: `Frame: ${bytes.length} bytes on wire (${bytes.length * 8} bits)`,
      children: [],
      offset: 0,
      length: bytes.length,
    },
  ]

  const decoded = decodePacket(bytes)

  for (const layer of decoded.layers) {
    const spec = findLayer(layer.layerId)
    if (!spec) {
      continue
    }
    const described = spec.describe(layer.values)
    nodes.push({
      label: described.label,
      children: (described.children ?? []).map((c) => ({
        label: c.label,
        children: [],
      })),
      offset: layer.offset,
      length: layer.length,
    })
  }

  if (decoded.payload.length > 0) {
    nodes.push({
      label: `Data (${decoded.payload.length} bytes)`,
      children: [],
      offset: decoded.payloadOffset,
      length: decoded.payload.length,
    })
  }

  return nodes
}

export interface RowSummary {
  source: string
  destination: string
  protocol: string
  length: number
  info: string
}

/**
 * Compute what one row of the preview list shows.
 *
 * Like buildDecodeTree it takes bytes rather than the model, so it always shows
 * the bytes about to be exported, decoded again.
 */
export function summarizeRow(bytes: Uint8Array): RowSummary {
  const decoded = decodePacket(bytes)

  // Prefer IPv4 addresses and fall back to the Ethernet MACs when there is no IPv4 layer.
  // Wireshark uses the same rule: users care about the highest-layer address.
  const addressLayer =
    decoded.layers.find((l) => l.layerId === 'ipv4') ??
    decoded.layers.find((l) => l.layerId === 'ethernet')

  const innermost = decoded.layers[decoded.layers.length - 1]
  const spec = innermost ? findLayer(innermost.layerId) : undefined

  return {
    source: String(addressLayer?.values.src ?? ''),
    destination: String(addressLayer?.values.dst ?? ''),
    protocol: spec?.shortName ?? '—',
    length: bytes.length,
    info: spec && innermost ? spec.summary(innermost.values) : '',
  }
}
