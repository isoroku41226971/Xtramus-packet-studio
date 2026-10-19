import { manualOr } from '../fields'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'
import { layerIdForUdpPort } from '../protocol-numbers'
import { computeTransportChecksum } from '../transport-checksum'

const HEADER_LENGTH = 8
const IP_PROTOCOL_UDP = 17

/**
 * RFC 768: a checksum field of 0x0000 is reserved for "no checksum", so a computed
 * value of 0 must be sent as 0xFFFF (the two are equivalent in one's complement).
 */
export function udpChecksumForTransmission(computed: number): number {
  return computed === 0x0000 ? 0xffff : computed
}

export const udpLayer: LayerSpec = {
  id: 'udp',
  name: 'User Datagram Protocol',
  shortName: 'UDP',
  stackable: false,

  fields: [
    { name: 'srcPort', label: 'Source Port', kind: 'uint', bits: 16 },
    { name: 'dstPort', label: 'Destination Port', kind: 'uint', bits: 16 },
    { name: 'length', label: 'Length', kind: 'uint', bits: 16, auto: true },
    { name: 'checksum', label: 'Checksum', kind: 'uint', bits: 16, auto: true },
  ],

  defaults: () => ({
    srcPort: { mode: 'manual', value: 1024 },
    dstPort: { mode: 'manual', value: 1024 },
    length: { mode: 'auto' },
    checksum: { mode: 'auto' },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const srcPort = manualOr<number>(fields.srcPort, () => 1024)
    const dstPort = manualOr<number>(fields.dstPort, () => 1024)
    const length = manualOr<number>(fields.length, () => HEADER_LENGTH + ctx.inner.length)

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes[0] = (srcPort >>> 8) & 0xff
    bytes[1] = srcPort & 0xff
    bytes[2] = (dstPort >>> 8) & 0xff
    bytes[3] = dstPort & 0xff
    bytes[4] = (length >>> 8) & 0xff
    bytes[5] = length & 0xff
    // leave the checksum at 0 for now and fill it in afterwards
    bytes[6] = 0
    bytes[7] = 0

    const checksum = manualOr<number>(fields.checksum, () =>
      udpChecksumForTransmission(
        computeTransportChecksum(ctx, IP_PROTOCOL_UDP, bytes, length),
      ),
    )

    bytes[6] = (checksum >>> 8) & 0xff
    bytes[7] = checksum & 0xff

    return { bytes, values: { srcPort, dstPort, length, checksum } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`UDP 標頭需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    const srcPort = (bytes[offset] << 8) | bytes[offset + 1]
    const dstPort = (bytes[offset + 2] << 8) | bytes[offset + 3]
    return {
      values: {
        srcPort,
        dstPort,
        length: (bytes[offset + 4] << 8) | bytes[offset + 5],
        checksum: (bytes[offset + 6] << 8) | bytes[offset + 7],
      },
      consumed: HEADER_LENGTH,
      // decode further only for recognized ports; everything else becomes payload
      nextLayerId: layerIdForUdpPort(srcPort, dstPort),
    }
  },

  describe(values): TreeNode {
    return {
      label: `User Datagram Protocol, Src Port: ${values.srcPort}, Dst Port: ${values.dstPort}`,
      children: [
        { label: `Source Port: ${values.srcPort}` },
        { label: `Destination Port: ${values.dstPort}` },
        { label: `Length: ${values.length}` },
        { label: `Checksum: 0x${(values.checksum as number).toString(16).padStart(4, '0')}` },
      ],
    }
  },

  summary(values): string {
    return `${values.srcPort} → ${values.dstPort} Len=${values.length}`
  },
}
