import { internetChecksum } from '../checksum'
import { manualOr } from '../fields'
import { formatIpv4, parseIpv4 } from '../format'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'
import { IP_PROTOCOL_BY_LAYER, layerIdForIpProtocol } from '../protocol-numbers'

const BASE_HEADER_LENGTH = 20

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

export const ipv4Layer: LayerSpec = {
  id: 'ipv4',
  name: 'Internet Protocol Version 4',
  shortName: 'IPv4',
  stackable: false,

  fields: [
    { name: 'version', label: 'Version', kind: 'uint', bits: 4 },
    { name: 'ihl', label: 'Header Length', kind: 'uint', bits: 4, auto: true },
    { name: 'dscp', label: 'DSCP', kind: 'uint', bits: 6 },
    { name: 'ecn', label: 'ECN', kind: 'uint', bits: 2 },
    { name: 'totalLength', label: 'Total Length', kind: 'uint', bits: 16, auto: true },
    { name: 'identification', label: 'Identification', kind: 'uint', bits: 16 },
    { name: 'flagDf', label: "Don't Fragment", kind: 'bool' },
    { name: 'flagMf', label: 'More Fragments', kind: 'bool' },
    { name: 'fragmentOffset', label: 'Fragment Offset', kind: 'uint', bits: 13 },
    { name: 'ttl', label: 'Time to Live', kind: 'uint', bits: 8 },
    { name: 'protocol', label: 'Protocol', kind: 'uint', bits: 8, auto: true },
    { name: 'headerChecksum', label: 'Header Checksum', kind: 'uint', bits: 16, auto: true },
    { name: 'src', label: 'Source Address', kind: 'ipv4' },
    { name: 'dst', label: 'Destination Address', kind: 'ipv4' },
    { name: 'options', label: 'Options', kind: 'bytes' },
  ],

  defaults: () => ({
    version: { mode: 'manual', value: 4 },
    ihl: { mode: 'auto' },
    dscp: { mode: 'manual', value: 0 },
    ecn: { mode: 'manual', value: 0 },
    totalLength: { mode: 'auto' },
    identification: { mode: 'manual', value: 0 },
    flagDf: { mode: 'manual', value: false },
    flagMf: { mode: 'manual', value: false },
    fragmentOffset: { mode: 'manual', value: 0 },
    ttl: { mode: 'manual', value: 64 },
    protocol: { mode: 'auto' },
    headerChecksum: { mode: 'auto' },
    src: { mode: 'manual', value: '192.168.0.1' },
    dst: { mode: 'manual', value: '192.168.0.2' },
    options: { mode: 'manual', value: new Uint8Array(0) },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const options = padOptions(manualOr<Uint8Array>(fields.options, () => new Uint8Array(0)))
    const headerLength = BASE_HEADER_LENGTH + options.length

    const version = manualOr<number>(fields.version, () => 4)
    const ihl = manualOr<number>(fields.ihl, () => headerLength / 4)
    const dscp = manualOr<number>(fields.dscp, () => 0)
    const ecn = manualOr<number>(fields.ecn, () => 0)
    const totalLength = manualOr<number>(fields.totalLength, () => headerLength + ctx.inner.length)
    const identification = manualOr<number>(fields.identification, () => 0)
    const flagDf = manualOr<boolean>(fields.flagDf, () => false)
    const flagMf = manualOr<boolean>(fields.flagMf, () => false)
    const fragmentOffset = manualOr<number>(fields.fragmentOffset, () => 0)
    const ttl = manualOr<number>(fields.ttl, () => 64)
    const protocol = manualOr<number>(fields.protocol, () => {
      const innerLayerId = ctx.layers[ctx.index + 1]?.layerId
      const auto = innerLayerId ? IP_PROTOCOL_BY_LAYER[innerLayerId] : undefined
      if (auto === undefined) {
        throw new Error(
          `無法自動決定 protocol：內層是 ${innerLayerId ?? '（沒有內層）'}，請手動指定`,
        )
      }
      return auto
    })
    const src = manualOr<string>(fields.src, () => '192.168.0.1')
    const dst = manualOr<string>(fields.dst, () => '192.168.0.2')

    const bytes = new Uint8Array(headerLength)
    bytes[0] = ((version & 0x0f) << 4) | (ihl & 0x0f)
    bytes[1] = ((dscp & 0x3f) << 2) | (ecn & 0x03)
    bytes[2] = (totalLength >>> 8) & 0xff
    bytes[3] = totalLength & 0xff
    bytes[4] = (identification >>> 8) & 0xff
    bytes[5] = identification & 0xff
    const flagsAndOffset =
      (flagDf ? 0x4000 : 0) | (flagMf ? 0x2000 : 0) | (fragmentOffset & 0x1fff)
    bytes[6] = (flagsAndOffset >>> 8) & 0xff
    bytes[7] = flagsAndOffset & 0xff
    bytes[8] = ttl & 0xff
    bytes[9] = protocol & 0xff
    // leave the checksum at 0 for now and fill it in afterwards
    bytes[10] = 0
    bytes[11] = 0
    bytes.set(parseIpv4(src), 12)
    bytes.set(parseIpv4(dst), 16)
    bytes.set(options, BASE_HEADER_LENGTH)

    // the checksum covers the whole header (including options), with the field itself treated as 0
    const headerChecksum = manualOr<number>(fields.headerChecksum, () => internetChecksum(bytes))
    bytes[10] = (headerChecksum >>> 8) & 0xff
    bytes[11] = headerChecksum & 0xff

    return {
      bytes,
      values: {
        version, ihl, dscp, ecn, totalLength, identification,
        flagDf, flagMf, fragmentOffset, ttl, protocol, headerChecksum,
        src, dst, options,
      },
    }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < BASE_HEADER_LENGTH) {
      throw new Error(`IPv4 標頭需要至少 ${BASE_HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    const ihl = bytes[offset] & 0x0f
    const headerLength = ihl * 4
    if (bytes.length - offset < headerLength) {
      throw new Error(`IPv4 標頭宣告 ${headerLength} bytes，只剩 ${bytes.length - offset}`)
    }
    const flagsAndOffset = (bytes[offset + 6] << 8) | bytes[offset + 7]
    const protocol = bytes[offset + 9]

    return {
      values: {
        version: (bytes[offset] >>> 4) & 0x0f,
        ihl,
        dscp: (bytes[offset + 1] >>> 2) & 0x3f,
        ecn: bytes[offset + 1] & 0x03,
        totalLength: (bytes[offset + 2] << 8) | bytes[offset + 3],
        identification: (bytes[offset + 4] << 8) | bytes[offset + 5],
        flagDf: (flagsAndOffset & 0x4000) !== 0,
        flagMf: (flagsAndOffset & 0x2000) !== 0,
        fragmentOffset: flagsAndOffset & 0x1fff,
        ttl: bytes[offset + 8],
        protocol,
        headerChecksum: (bytes[offset + 10] << 8) | bytes[offset + 11],
        src: formatIpv4(bytes, offset + 12),
        dst: formatIpv4(bytes, offset + 16),
        options: bytes.slice(offset + BASE_HEADER_LENGTH, offset + headerLength),
      },
      consumed: headerLength,
      nextLayerId: layerIdForIpProtocol(protocol),
    }
  },

  describe(values): TreeNode {
    return {
      label: `Internet Protocol Version 4, Src: ${values.src}, Dst: ${values.dst}`,
      children: [
        { label: `Version: ${values.version}` },
        { label: `Header Length: ${(values.ihl as number) * 4} bytes (${values.ihl})` },
        { label: `Total Length: ${values.totalLength}` },
        { label: `Identification: 0x${(values.identification as number).toString(16).padStart(4, '0')}` },
        { label: `Flags: DF=${values.flagDf ? 1 : 0}, MF=${values.flagMf ? 1 : 0}` },
        { label: `Fragment Offset: ${values.fragmentOffset}` },
        { label: `Time to Live: ${values.ttl}` },
        { label: `Protocol: ${values.protocol}` },
        { label: `Header Checksum: 0x${(values.headerChecksum as number).toString(16).padStart(4, '0')}` },
        { label: `Source Address: ${values.src}` },
        { label: `Destination Address: ${values.dst}` },
      ],
    }
  },

  summary(values): string {
    return `${values.src} → ${values.dst}`
  },
}
