import { internetChecksum } from '../checksum'
import { manualOr } from '../fields'
import { formatIpv4, parseIpv4 } from '../format'
import type { BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'

const HEADER_LENGTH = 8

/**
 * Names of common IGMP types, for display only.
 * 0x22 (v3 Membership Report) is listed so the decode tree can at least name it,
 * but this layer does not interpret the v3 group record structure.
 */
const TYPE_NAMES: Record<number, string> = {
  0x11: 'Membership Query',
  0x12: 'Membership Report (v1)',
  0x16: 'Membership Report (v2)',
  0x17: 'Leave Group',
  0x22: 'Membership Report (v3)',
}

function typeName(type: number): string {
  return TYPE_NAMES[type] ?? `Type 0x${type.toString(16).padStart(2, '0')}`
}

export const igmpLayer: LayerSpec = {
  id: 'igmp',
  name: 'Internet Group Management Protocol',
  shortName: 'IGMP',
  stackable: false,

  fields: [
    { name: 'type', label: 'Type', kind: 'uint', bits: 8 },
    { name: 'maxRespTime', label: 'Max Resp Time', kind: 'uint', bits: 8 },
    { name: 'checksum', label: 'Checksum', kind: 'uint', bits: 16, auto: true },
    { name: 'groupAddress', label: 'Multicast Address', kind: 'ipv4' },
  ],

  defaults: () => ({
    type: { mode: 'manual', value: 0x16 },
    maxRespTime: { mode: 'manual', value: 0 },
    checksum: { mode: 'auto' },
    groupAddress: { mode: 'manual', value: '224.0.0.1' },
  }),

  build(fields): BuildOutput {
    const type = manualOr<number>(fields.type, () => 0x16)
    const maxRespTime = manualOr<number>(fields.maxRespTime, () => 0)
    const groupAddress = manualOr<string>(fields.groupAddress, () => '224.0.0.1')

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes[0] = type & 0xff
    bytes[1] = maxRespTime & 0xff
    // leave the checksum at 0 for now and fill it in afterwards
    bytes[2] = 0
    bytes[3] = 0
    bytes.set(parseIpv4(groupAddress), 4)

    // IGMP has no pseudo-header; the checksum covers only these 8 bytes
    const checksum = manualOr<number>(fields.checksum, () => internetChecksum(bytes))
    bytes[2] = (checksum >>> 8) & 0xff
    bytes[3] = checksum & 0xff

    return { bytes, values: { type, maxRespTime, checksum, groupAddress } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`IGMP 標頭需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    return {
      values: {
        type: bytes[offset],
        maxRespTime: bytes[offset + 1],
        checksum: (bytes[offset + 2] << 8) | bytes[offset + 3],
        groupAddress: formatIpv4(bytes, offset + 4),
      },
      consumed: HEADER_LENGTH,
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    return {
      label: 'Internet Group Management Protocol',
      children: [
        {
          label: `Type: 0x${(values.type as number).toString(16).padStart(2, '0')} (${typeName(values.type as number)})`,
        },
        { label: `Max Resp Time: ${values.maxRespTime}` },
        { label: `Checksum: 0x${(values.checksum as number).toString(16).padStart(4, '0')}` },
        { label: `Multicast Address: ${values.groupAddress}` },
      ],
    }
  },

  summary(values): string {
    return `${typeName(values.type as number)}  ${values.groupAddress}`
  },
}
