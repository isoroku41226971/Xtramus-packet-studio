import { manualOr } from '../fields'
import { formatIpv4, formatMac, parseIpv4, parseMac } from '../format'
import type { BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'

const FIXED_LENGTH = 236
const MAGIC_COOKIE = [0x63, 0x82, 0x53, 0x63]
const HEADER_LENGTH = FIXED_LENGTH + MAGIC_COOKIE.length // 240

const CHADDR_OFFSET = 28
const SNAME_OFFSET = 44
const SNAME_LENGTH = 64
const FILE_OFFSET = 108
const FILE_LENGTH = 128

const OPTION_PAD = 0
const OPTION_END = 255

export interface DhcpOption {
  code: number
  data: Uint8Array
}

/**
 * Encode the option list as TLVs, ending with End (255).
 * Per RFC 2132, Pad (0) and End (255) have no length field.
 */
export function encodeDhcpOptions(options: DhcpOption[]): Uint8Array {
  const chunks: number[] = []
  for (const opt of options) {
    if (opt.code === OPTION_PAD || opt.code === OPTION_END) {
      chunks.push(opt.code)
      continue
    }
    chunks.push(opt.code, opt.data.length, ...opt.data)
  }
  chunks.push(OPTION_END)
  return new Uint8Array(chunks)
}

/**
 * Decode TLV options starting at offset until End (255) or the bytes run out.
 *
 * Bad data whose declared length exceeds the remaining bytes stops decoding without
 * throwing: when importing a real capture, one bad packet must not abort the whole batch.
 */
export function decodeDhcpOptions(
  bytes: Uint8Array,
  offset: number,
): { options: DhcpOption[]; consumed: number } {
  const options: DhcpOption[] = []
  let i = offset

  while (i < bytes.length) {
    const code = bytes[i]
    if (code === OPTION_END) {
      i += 1
      break
    }
    if (code === OPTION_PAD) {
      i += 1
      continue
    }
    if (i + 1 >= bytes.length) {
      i += 1
      break
    }
    const length = bytes[i + 1]
    if (i + 2 + length > bytes.length) {
      // the declared length exceeds the actual data, so stop here
      break
    }
    options.push({ code, data: bytes.slice(i + 2, i + 2 + length) })
    i += 2 + length
  }

  return { options, consumed: i - offset }
}

/** Write a fixed-length string field, truncating if too long and zero-padding if short. */
function writeFixedString(target: Uint8Array, offset: number, length: number, value: string): void {
  for (let i = 0; i < length; i++) {
    target[offset + i] = i < value.length ? value.charCodeAt(i) & 0xff : 0
  }
}

/** Read a fixed-length string field, dropping everything from the first zero byte on. */
function readFixedString(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset
  while (end < offset + length && bytes[end] !== 0) {
    end += 1
  }
  return String.fromCharCode(...bytes.slice(offset, end))
}

export const dhcpLayer: LayerSpec = {
  id: 'dhcp',
  name: 'Dynamic Host Configuration Protocol',
  shortName: 'DHCP',
  stackable: false,

  fields: [
    { name: 'op', label: 'Message Type', kind: 'uint', bits: 8 },
    { name: 'htype', label: 'Hardware Type', kind: 'uint', bits: 8, auto: true },
    { name: 'hlen', label: 'Hardware Address Length', kind: 'uint', bits: 8, auto: true },
    { name: 'hops', label: 'Hops', kind: 'uint', bits: 8 },
    { name: 'xid', label: 'Transaction ID', kind: 'uint', bits: 32 },
    { name: 'secs', label: 'Seconds Elapsed', kind: 'uint', bits: 16 },
    { name: 'flags', label: 'Bootp Flags', kind: 'uint', bits: 16 },
    { name: 'ciaddr', label: 'Client IP Address', kind: 'ipv4' },
    { name: 'yiaddr', label: 'Your IP Address', kind: 'ipv4' },
    { name: 'siaddr', label: 'Next Server IP Address', kind: 'ipv4' },
    { name: 'giaddr', label: 'Relay Agent IP Address', kind: 'ipv4' },
    { name: 'chaddr', label: 'Client MAC Address', kind: 'mac' },
    { name: 'sname', label: 'Server Host Name', kind: 'string' },
    { name: 'file', label: 'Boot File Name', kind: 'string' },
    { name: 'options', label: 'Options', kind: 'custom' },
  ],

  defaults: () => ({
    op: { mode: 'manual', value: 1 },
    htype: { mode: 'auto' },
    hlen: { mode: 'auto' },
    hops: { mode: 'manual', value: 0 },
    xid: { mode: 'manual', value: 0 },
    secs: { mode: 'manual', value: 0 },
    flags: { mode: 'manual', value: 0 },
    ciaddr: { mode: 'manual', value: '0.0.0.0' },
    yiaddr: { mode: 'manual', value: '0.0.0.0' },
    siaddr: { mode: 'manual', value: '0.0.0.0' },
    giaddr: { mode: 'manual', value: '0.0.0.0' },
    chaddr: { mode: 'manual', value: '00:11:22:33:44:55' },
    sname: { mode: 'manual', value: '' },
    file: { mode: 'manual', value: '' },
    options: { mode: 'manual', value: [{ code: 53, data: new Uint8Array([1]) }] },
  }),

  build(fields): BuildOutput {
    const op = manualOr<number>(fields.op, () => 1)
    const htype = manualOr<number>(fields.htype, () => 1)
    const hlen = manualOr<number>(fields.hlen, () => 6)
    const hops = manualOr<number>(fields.hops, () => 0)
    const xid = manualOr<number>(fields.xid, () => 0)
    const secs = manualOr<number>(fields.secs, () => 0)
    const flags = manualOr<number>(fields.flags, () => 0)
    const ciaddr = manualOr<string>(fields.ciaddr, () => '0.0.0.0')
    const yiaddr = manualOr<string>(fields.yiaddr, () => '0.0.0.0')
    const siaddr = manualOr<string>(fields.siaddr, () => '0.0.0.0')
    const giaddr = manualOr<string>(fields.giaddr, () => '0.0.0.0')
    const chaddr = manualOr<string>(fields.chaddr, () => '00:11:22:33:44:55')
    const sname = manualOr<string>(fields.sname, () => '')
    const file = manualOr<string>(fields.file, () => '')
    const options = manualOr<DhcpOption[]>(fields.options, () => [])

    const optionBytes = encodeDhcpOptions(options)
    const bytes = new Uint8Array(HEADER_LENGTH + optionBytes.length)

    bytes[0] = op & 0xff
    bytes[1] = htype & 0xff
    bytes[2] = hlen & 0xff
    bytes[3] = hops & 0xff
    bytes[4] = (xid >>> 24) & 0xff
    bytes[5] = (xid >>> 16) & 0xff
    bytes[6] = (xid >>> 8) & 0xff
    bytes[7] = xid & 0xff
    bytes[8] = (secs >>> 8) & 0xff
    bytes[9] = secs & 0xff
    bytes[10] = (flags >>> 8) & 0xff
    bytes[11] = flags & 0xff
    bytes.set(parseIpv4(ciaddr), 12)
    bytes.set(parseIpv4(yiaddr), 16)
    bytes.set(parseIpv4(siaddr), 20)
    bytes.set(parseIpv4(giaddr), 24)
    // chaddr is a 16-byte field; the MAC takes the first 6 bytes and the rest stay zero
    bytes.set(parseMac(chaddr), CHADDR_OFFSET)
    writeFixedString(bytes, SNAME_OFFSET, SNAME_LENGTH, sname)
    writeFixedString(bytes, FILE_OFFSET, FILE_LENGTH, file)
    bytes.set(MAGIC_COOKIE, FIXED_LENGTH)
    bytes.set(optionBytes, HEADER_LENGTH)

    return {
      bytes,
      values: {
        op, htype, hlen, hops, xid, secs, flags,
        ciaddr, yiaddr, siaddr, giaddr, chaddr, sname, file, options,
      },
    }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`DHCP 需要至少 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }

    // the magic cookie is not validated: malformed packets must still be viewable ("warn, don't block")
    const { options, consumed: optionsConsumed } = decodeDhcpOptions(bytes, offset + HEADER_LENGTH)

    const xid =
      ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) |
       (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0

    return {
      values: {
        op: bytes[offset],
        htype: bytes[offset + 1],
        hlen: bytes[offset + 2],
        hops: bytes[offset + 3],
        xid,
        secs: (bytes[offset + 8] << 8) | bytes[offset + 9],
        flags: (bytes[offset + 10] << 8) | bytes[offset + 11],
        ciaddr: formatIpv4(bytes, offset + 12),
        yiaddr: formatIpv4(bytes, offset + 16),
        siaddr: formatIpv4(bytes, offset + 20),
        giaddr: formatIpv4(bytes, offset + 24),
        chaddr: formatMac(bytes, offset + CHADDR_OFFSET),
        sname: readFixedString(bytes, offset + SNAME_OFFSET, SNAME_LENGTH),
        file: readFixedString(bytes, offset + FILE_OFFSET, FILE_LENGTH),
        options,
      },
      consumed: HEADER_LENGTH + optionsConsumed,
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    const options = values.options as DhcpOption[]
    return {
      label: 'Dynamic Host Configuration Protocol',
      children: [
        { label: `Message type: ${values.op === 1 ? 'Boot Request' : 'Boot Reply'} (${values.op})` },
        { label: `Hardware type: ${values.htype}` },
        { label: `Hardware address length: ${values.hlen}` },
        { label: `Hops: ${values.hops}` },
        { label: `Transaction ID: 0x${(values.xid as number).toString(16).padStart(8, '0')}` },
        { label: `Seconds elapsed: ${values.secs}` },
        { label: `Bootp flags: 0x${(values.flags as number).toString(16).padStart(4, '0')}` },
        { label: `Client IP address: ${values.ciaddr}` },
        { label: `Your IP address: ${values.yiaddr}` },
        { label: `Next server IP address: ${values.siaddr}` },
        { label: `Relay agent IP address: ${values.giaddr}` },
        { label: `Client MAC address: ${values.chaddr}` },
        ...options.map((o) => ({ label: `Option: (${o.code}) ${o.data.length} bytes` })),
      ],
    }
  },

  summary(values): string {
    const kind = values.op === 1 ? 'Request' : 'Reply'
    return `DHCP ${kind} - Transaction ID 0x${(values.xid as number).toString(16).padStart(8, '0')}`
  },
}
