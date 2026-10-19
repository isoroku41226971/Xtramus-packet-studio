import { manualOr } from '../fields'
import { formatIpv4, formatMac, parseIpv4, parseMac } from '../format'
import type { BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'

const HEADER_LENGTH = 28

const OPCODE_NAMES: Record<number, string> = {
  1: 'request',
  2: 'reply',
}

export const arpLayer: LayerSpec = {
  id: 'arp',
  name: 'Address Resolution Protocol',
  shortName: 'ARP',
  stackable: false,

  fields: [
    { name: 'hardwareType', label: 'Hardware Type', kind: 'uint', bits: 16, auto: true },
    { name: 'protocolType', label: 'Protocol Type', kind: 'uint', bits: 16, auto: true },
    { name: 'hardwareSize', label: 'Hardware Size', kind: 'uint', bits: 8, auto: true },
    { name: 'protocolSize', label: 'Protocol Size', kind: 'uint', bits: 8, auto: true },
    { name: 'opcode', label: 'Opcode', kind: 'uint', bits: 16 },
    { name: 'senderMac', label: 'Sender MAC Address', kind: 'mac' },
    { name: 'senderIp', label: 'Sender IP Address', kind: 'ipv4' },
    { name: 'targetMac', label: 'Target MAC Address', kind: 'mac' },
    { name: 'targetIp', label: 'Target IP Address', kind: 'ipv4' },
  ],

  defaults: () => ({
    hardwareType: { mode: 'auto' },
    protocolType: { mode: 'auto' },
    hardwareSize: { mode: 'auto' },
    protocolSize: { mode: 'auto' },
    opcode: { mode: 'manual', value: 1 },
    senderMac: { mode: 'manual', value: '00:11:22:33:44:55' },
    senderIp: { mode: 'manual', value: '192.168.0.1' },
    targetMac: { mode: 'manual', value: '00:00:00:00:00:00' },
    targetIp: { mode: 'manual', value: '192.168.0.2' },
  }),

  build(fields): BuildOutput {
    // these four are fixed for Ethernet/IPv4 but can still be overridden to build malformed packets
    const hardwareType = manualOr<number>(fields.hardwareType, () => 1)
    const protocolType = manualOr<number>(fields.protocolType, () => 0x0800)
    const hardwareSize = manualOr<number>(fields.hardwareSize, () => 6)
    const protocolSize = manualOr<number>(fields.protocolSize, () => 4)
    const opcode = manualOr<number>(fields.opcode, () => 1)
    const senderMac = manualOr<string>(fields.senderMac, () => '00:11:22:33:44:55')
    const senderIp = manualOr<string>(fields.senderIp, () => '192.168.0.1')
    const targetMac = manualOr<string>(fields.targetMac, () => '00:00:00:00:00:00')
    const targetIp = manualOr<string>(fields.targetIp, () => '192.168.0.2')

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes[0] = (hardwareType >>> 8) & 0xff
    bytes[1] = hardwareType & 0xff
    bytes[2] = (protocolType >>> 8) & 0xff
    bytes[3] = protocolType & 0xff
    bytes[4] = hardwareSize & 0xff
    bytes[5] = protocolSize & 0xff
    bytes[6] = (opcode >>> 8) & 0xff
    bytes[7] = opcode & 0xff
    bytes.set(parseMac(senderMac), 8)
    bytes.set(parseIpv4(senderIp), 14)
    bytes.set(parseMac(targetMac), 18)
    bytes.set(parseIpv4(targetIp), 24)

    return {
      bytes,
      values: {
        hardwareType, protocolType, hardwareSize, protocolSize, opcode,
        senderMac, senderIp, targetMac, targetIp,
      },
    }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`ARP 需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    return {
      values: {
        hardwareType: (bytes[offset] << 8) | bytes[offset + 1],
        protocolType: (bytes[offset + 2] << 8) | bytes[offset + 3],
        hardwareSize: bytes[offset + 4],
        protocolSize: bytes[offset + 5],
        opcode: (bytes[offset + 6] << 8) | bytes[offset + 7],
        senderMac: formatMac(bytes, offset + 8),
        senderIp: formatIpv4(bytes, offset + 14),
        targetMac: formatMac(bytes, offset + 18),
        targetIp: formatIpv4(bytes, offset + 24),
      },
      consumed: HEADER_LENGTH,
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    return {
      label: 'Address Resolution Protocol',
      children: [
        { label: `Hardware Type: ${values.hardwareType}` },
        { label: `Protocol Type: 0x${(values.protocolType as number).toString(16).padStart(4, '0')}` },
        { label: `Hardware Size: ${values.hardwareSize}` },
        { label: `Protocol Size: ${values.protocolSize}` },
        { label: `Opcode: ${values.opcode} (${OPCODE_NAMES[values.opcode as number] ?? 'unknown'})` },
        { label: `Sender MAC Address: ${values.senderMac}` },
        { label: `Sender IP Address: ${values.senderIp}` },
        { label: `Target MAC Address: ${values.targetMac}` },
        { label: `Target IP Address: ${values.targetIp}` },
      ],
    }
  },

  summary(values): string {
    if (values.opcode === 1) {
      return `Who has ${values.targetIp}? Tell ${values.senderIp}`
    }
    if (values.opcode === 2) {
      return `${values.senderIp} is at ${values.senderMac}`
    }
    return `ARP opcode ${values.opcode}`
  },
}
