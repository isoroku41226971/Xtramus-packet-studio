import { internetChecksum } from '../checksum'
import { manualOr } from '../fields'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'

const HEADER_LENGTH = 8

/** Names of common ICMP types, for display only. */
const TYPE_NAMES: Record<number, string> = {
  0: 'Echo Reply',
  3: 'Destination Unreachable',
  5: 'Redirect',
  8: 'Echo Request',
  11: 'Time Exceeded',
}

function typeName(type: number): string {
  return TYPE_NAMES[type] ?? `Type ${type}`
}

export const icmpLayer: LayerSpec = {
  id: 'icmp',
  name: 'Internet Control Message Protocol',
  shortName: 'ICMP',
  stackable: false,

  fields: [
    { name: 'type', label: 'Type', kind: 'uint', bits: 8 },
    { name: 'code', label: 'Code', kind: 'uint', bits: 8 },
    { name: 'checksum', label: 'Checksum', kind: 'uint', bits: 16, auto: true },
    { name: 'identifier', label: 'Identifier', kind: 'uint', bits: 16 },
    { name: 'sequence', label: 'Sequence Number', kind: 'uint', bits: 16 },
  ],

  defaults: () => ({
    type: { mode: 'manual', value: 8 },
    code: { mode: 'manual', value: 0 },
    checksum: { mode: 'auto' },
    identifier: { mode: 'manual', value: 1 },
    sequence: { mode: 'manual', value: 1 },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const type = manualOr<number>(fields.type, () => 8)
    const code = manualOr<number>(fields.code, () => 0)
    const identifier = manualOr<number>(fields.identifier, () => 1)
    const sequence = manualOr<number>(fields.sequence, () => 1)

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes[0] = type & 0xff
    bytes[1] = code & 0xff
    // leave the checksum at 0 for now and fill it in afterwards
    bytes[2] = 0
    bytes[3] = 0
    bytes[4] = (identifier >>> 8) & 0xff
    bytes[5] = identifier & 0xff
    bytes[6] = (sequence >>> 8) & 0xff
    bytes[7] = sequence & 0xff

    // ICMP has no pseudo-header; the checksum covers only the header and its own payload
    const checksum = manualOr<number>(fields.checksum, () => {
      const all = new Uint8Array(bytes.length + ctx.inner.length)
      all.set(bytes, 0)
      all.set(ctx.inner, bytes.length)
      return internetChecksum(all)
    })
    bytes[2] = (checksum >>> 8) & 0xff
    bytes[3] = checksum & 0xff

    return { bytes, values: { type, code, checksum, identifier, sequence } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`ICMP 標頭需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    return {
      values: {
        type: bytes[offset],
        code: bytes[offset + 1],
        checksum: (bytes[offset + 2] << 8) | bytes[offset + 3],
        identifier: (bytes[offset + 4] << 8) | bytes[offset + 5],
        sequence: (bytes[offset + 6] << 8) | bytes[offset + 7],
      },
      consumed: HEADER_LENGTH,
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    return {
      label: 'Internet Control Message Protocol',
      children: [
        { label: `Type: ${values.type} (${typeName(values.type as number)})` },
        { label: `Code: ${values.code}` },
        { label: `Checksum: 0x${(values.checksum as number).toString(16).padStart(4, '0')}` },
        { label: `Identifier: ${values.identifier}` },
        { label: `Sequence Number: ${values.sequence}` },
      ],
    }
  },

  summary(values): string {
    return `${typeName(values.type as number)}  id=${values.identifier}  seq=${values.sequence}`
  },
}
