import { manualOr } from '../fields'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'
import { computeTransportChecksum } from '../transport-checksum'

const BASE_HEADER_LENGTH = 20
const IP_PROTOCOL_TCP = 6

/** Flag field name -> display name -> bit mask in byte 13. */
const FLAG_BITS: Array<[string, string, number]> = [
  ['flagCwr', 'CWR', 0x80],
  ['flagEce', 'ECE', 0x40],
  ['flagUrg', 'URG', 0x20],
  ['flagAck', 'ACK', 0x10],
  ['flagPsh', 'PSH', 0x08],
  ['flagRst', 'RST', 0x04],
  ['flagSyn', 'SYN', 0x02],
  ['flagFin', 'FIN', 0x01],
]

function activeFlagNames(values: Record<string, unknown>): string[] {
  return FLAG_BITS.filter(([name]) => values[name] === true).map(([, label]) => label)
}

/** Pad options with zeros to a multiple of 4. */
function padOptions(options: Uint8Array): Uint8Array {
  const remainder = options.length % 4
  if (remainder === 0) {
    return options
  }
  const padded = new Uint8Array(options.length + (4 - remainder))
  padded.set(options, 0)
  return padded
}

export const tcpLayer: LayerSpec = {
  id: 'tcp',
  name: 'Transmission Control Protocol',
  shortName: 'TCP',
  stackable: false,

  fields: [
    { name: 'srcPort', label: 'Source Port', kind: 'uint', bits: 16 },
    { name: 'dstPort', label: 'Destination Port', kind: 'uint', bits: 16 },
    { name: 'seq', label: 'Sequence Number', kind: 'uint', bits: 32 },
    { name: 'ack', label: 'Acknowledgment Number', kind: 'uint', bits: 32 },
    { name: 'dataOffset', label: 'Data Offset', kind: 'uint', bits: 4, auto: true },
    { name: 'reserved', label: 'Reserved', kind: 'uint', bits: 4 },
    { name: 'flagCwr', label: 'CWR', kind: 'bool' },
    { name: 'flagEce', label: 'ECE', kind: 'bool' },
    { name: 'flagUrg', label: 'Urgent', kind: 'bool' },
    { name: 'flagAck', label: 'Acknowledgment', kind: 'bool' },
    { name: 'flagPsh', label: 'Push', kind: 'bool' },
    { name: 'flagRst', label: 'Reset', kind: 'bool' },
    { name: 'flagSyn', label: 'Syn', kind: 'bool' },
    { name: 'flagFin', label: 'Fin', kind: 'bool' },
    { name: 'window', label: 'Window', kind: 'uint', bits: 16 },
    { name: 'checksum', label: 'Checksum', kind: 'uint', bits: 16, auto: true },
    { name: 'urgentPointer', label: 'Urgent Pointer', kind: 'uint', bits: 16 },
    { name: 'options', label: 'Options', kind: 'bytes' },
  ],

  defaults: () => ({
    srcPort: { mode: 'manual', value: 1024 },
    dstPort: { mode: 'manual', value: 80 },
    seq: { mode: 'manual', value: 0 },
    ack: { mode: 'manual', value: 0 },
    dataOffset: { mode: 'auto' },
    reserved: { mode: 'manual', value: 0 },
    flagCwr: { mode: 'manual', value: false },
    flagEce: { mode: 'manual', value: false },
    flagUrg: { mode: 'manual', value: false },
    flagAck: { mode: 'manual', value: false },
    flagPsh: { mode: 'manual', value: false },
    flagRst: { mode: 'manual', value: false },
    flagSyn: { mode: 'manual', value: true },
    flagFin: { mode: 'manual', value: false },
    window: { mode: 'manual', value: 65535 },
    checksum: { mode: 'auto' },
    urgentPointer: { mode: 'manual', value: 0 },
    options: { mode: 'manual', value: new Uint8Array(0) },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const options = padOptions(manualOr<Uint8Array>(fields.options, () => new Uint8Array(0)))
    const headerLength = BASE_HEADER_LENGTH + options.length

    const srcPort = manualOr<number>(fields.srcPort, () => 1024)
    const dstPort = manualOr<number>(fields.dstPort, () => 80)
    const seq = manualOr<number>(fields.seq, () => 0)
    const ack = manualOr<number>(fields.ack, () => 0)
    const dataOffset = manualOr<number>(fields.dataOffset, () => headerLength / 4)
    const reserved = manualOr<number>(fields.reserved, () => 0)
    const window = manualOr<number>(fields.window, () => 65535)
    const urgentPointer = manualOr<number>(fields.urgentPointer, () => 0)

    const flags: Record<string, boolean> = {}
    let flagByte = 0
    for (const [name, , bit] of FLAG_BITS) {
      const on = manualOr<boolean>(fields[name], () => false)
      flags[name] = on
      if (on) {
        flagByte |= bit
      }
    }

    const bytes = new Uint8Array(headerLength)
    bytes[0] = (srcPort >>> 8) & 0xff
    bytes[1] = srcPort & 0xff
    bytes[2] = (dstPort >>> 8) & 0xff
    bytes[3] = dstPort & 0xff
    bytes[4] = (seq >>> 24) & 0xff
    bytes[5] = (seq >>> 16) & 0xff
    bytes[6] = (seq >>> 8) & 0xff
    bytes[7] = seq & 0xff
    bytes[8] = (ack >>> 24) & 0xff
    bytes[9] = (ack >>> 16) & 0xff
    bytes[10] = (ack >>> 8) & 0xff
    bytes[11] = ack & 0xff
    bytes[12] = ((dataOffset & 0x0f) << 4) | (reserved & 0x0f)
    bytes[13] = flagByte
    bytes[14] = (window >>> 8) & 0xff
    bytes[15] = window & 0xff
    // leave the checksum at 0 for now and fill it in afterwards
    bytes[16] = 0
    bytes[17] = 0
    bytes[18] = (urgentPointer >>> 8) & 0xff
    bytes[19] = urgentPointer & 0xff
    bytes.set(options, BASE_HEADER_LENGTH)

    // TCP has no UDP-style "send 0xFFFF when the result is 0" rule; 0x0000 is a valid value
    const checksum = manualOr<number>(fields.checksum, () =>
      computeTransportChecksum(ctx, IP_PROTOCOL_TCP, bytes, headerLength + ctx.inner.length),
    )
    bytes[16] = (checksum >>> 8) & 0xff
    bytes[17] = checksum & 0xff

    return {
      bytes,
      values: {
        srcPort, dstPort, seq, ack, dataOffset, reserved,
        ...flags,
        window, checksum, urgentPointer, options,
      },
    }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < BASE_HEADER_LENGTH) {
      throw new Error(`TCP 標頭需要至少 ${BASE_HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    const dataOffset = (bytes[offset + 12] >>> 4) & 0x0f
    const headerLength = dataOffset * 4
    if (bytes.length - offset < headerLength) {
      throw new Error(`TCP 標頭宣告 ${headerLength} bytes，只剩 ${bytes.length - offset}`)
    }

    const flagByte = bytes[offset + 13]
    const flags: Record<string, boolean> = {}
    for (const [name, , bit] of FLAG_BITS) {
      flags[name] = (flagByte & bit) !== 0
    }

    // >>> 0 converts the 32-bit result back to unsigned; otherwise it is negative when the top bit is set
    const seq =
      ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) |
       (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0
    const ack =
      ((bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) |
       (bytes[offset + 10] << 8) | bytes[offset + 11]) >>> 0

    return {
      values: {
        srcPort: (bytes[offset] << 8) | bytes[offset + 1],
        dstPort: (bytes[offset + 2] << 8) | bytes[offset + 3],
        seq,
        ack,
        dataOffset,
        reserved: bytes[offset + 12] & 0x0f,
        ...flags,
        window: (bytes[offset + 14] << 8) | bytes[offset + 15],
        checksum: (bytes[offset + 16] << 8) | bytes[offset + 17],
        urgentPointer: (bytes[offset + 18] << 8) | bytes[offset + 19],
        options: bytes.slice(offset + BASE_HEADER_LENGTH, offset + headerLength),
      },
      consumed: headerLength,
      // after TCP comes application payload, which is not decoded further
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    return {
      label: `Transmission Control Protocol, Src Port: ${values.srcPort}, Dst Port: ${values.dstPort}, Seq: ${values.seq}`,
      children: [
        { label: `Source Port: ${values.srcPort}` },
        { label: `Destination Port: ${values.dstPort}` },
        { label: `Sequence Number: ${values.seq}` },
        { label: `Acknowledgment Number: ${values.ack}` },
        { label: `Data Offset: ${(values.dataOffset as number) * 4} bytes (${values.dataOffset})` },
        { label: `Flags: ${activeFlagNames(values).join(', ') || '(none)'}` },
        { label: `Window: ${values.window}` },
        { label: `Checksum: 0x${(values.checksum as number).toString(16).padStart(4, '0')}` },
        { label: `Urgent Pointer: ${values.urgentPointer}` },
      ],
    }
  },

  summary(values): string {
    const flags = activeFlagNames(values)
    return `${values.srcPort} → ${values.dstPort} [${flags.join(', ')}] Seq=${values.seq} Win=${values.window}`
  },
}
