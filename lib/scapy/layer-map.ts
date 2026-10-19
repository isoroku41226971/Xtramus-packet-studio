import type { DecodedLayer } from '../packet/decode'

/**
 * The only ICMP types for which Scapy serializes id / seq.
 * Source: icmp_id_seq_types in scapy/layers/inet.py.
 */
const ICMP_ID_SEQ_TYPES = [0, 8, 13, 14, 15, 16, 17, 18, 37, 38]

/**
 * A decimal integer.
 *
 * >>> 0 rather than | 0: our uint fields are all unsigned and TCP seq / ack are
 * 32 bits, so `| 0` would turn 0xFFFFFFFF into -1 and produce a broken `seq=-1`.
 */
function num(v: unknown): string {
  return String(Number(v) >>> 0)
}

/**
 * 0x hexadecimal, padded to the given number of digits.
 *
 * Used only for Ether/Dot1Q type, IP.tos, any chksum and BOOTP.xid, which people
 * are used to reading in hex. ICMP/IGMP type and IP.proto stay decimal.
 */
function hex(v: unknown, digits: number): string {
  return `0x${(Number(v) >>> 0).toString(16).padStart(digits, '0')}`
}

/** MACs and IPv4 addresses are already strings at run time here, so they are just quoted. */
function quoted(v: unknown): string {
  return `"${String(v)}"`
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** MAC string -> 16-byte BOOTP chaddr (6-byte MAC + 10 zeros). */
function chaddr(v: unknown): string {
  const hexOnly = String(v)
    .replace(/[^0-9a-fA-F]/g, '')
    .toLowerCase()
  return `bytes.fromhex("${hexOnly}") + b"\\x00" * 10`
}

/** Plain text -> Python bytes literal. Non-ASCII is escaped as \\xNN. */
function pyByteString(v: unknown): string {
  const text = String(v ?? '')
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x20 && code <= 0x7e && ch !== '"' && ch !== '\\') {
      out += ch
      continue
    }
    out += `\\x${code.toString(16).padStart(2, '0')}`
  }
  return `b"${out}"`
}

/** Uint8Array -> bytes.fromhex("..."). */
function pyBytes(v: unknown): string {
  const bytes = v instanceof Uint8Array ? v : new Uint8Array(0)
  return `bytes.fromhex("${toHexString(bytes)}")`
}

/** Join field pairs into `a=1, b=2`. */
function args(pairs: Array<[string, string]>): string {
  return pairs.map(([k, v]) => `${k}=${v}`).join(', ')
}

/**
 * One decoded layer -> one or more Scapy expressions.
 *
 * Why possibly more than one: ICMP id/seq are conditional fields in Scapy, so for
 * other types those 4 bytes must be expressed with a trailing Raw.
 *
 * packetBytes is the whole packet; the TCP options fallback slices its own part from it.
 */
export function layerToScapy(layer: DecodedLayer, packetBytes: Uint8Array): string[] {
  const v = layer.values

  switch (layer.layerId) {
    case 'ethernet':
      return [
        `Ether(${args([
          ['dst', quoted(v.dst)],
          ['src', quoted(v.src)],
          ['type', hex(v.etherType, 4)],
        ])})`,
      ]

    case 'vlan':
      return [
        `Dot1Q(${args([
          ['prio', num(v.pcp)],
          ['dei', num(v.dei)],
          ['vlan', num(v.vid)],
          ['type', hex(v.etherType, 4)],
        ])})`,
      ]

    case 'udp':
      return [
        `UDP(${args([
          ['sport', num(v.srcPort)],
          ['dport', num(v.dstPort)],
          ['len', num(v.length)],
          ['chksum', hex(v.checksum, 4)],
        ])})`,
      ]

    case 'igmp':
      return [
        `IGMP(${args([
          ['type', num(v.type)],
          ['mrcode', num(v.maxRespTime)],
          ['chksum', hex(v.checksum, 4)],
          ['gaddr', quoted(v.groupAddress)],
        ])})`,
      ]

    case 'arp':
      return [
        `ARP(${args([
          ['hwtype', num(v.hardwareType)],
          ['ptype', hex(v.protocolType, 4)],
          ['hwlen', num(v.hardwareSize)],
          ['plen', num(v.protocolSize)],
          ['op', num(v.opcode)],
          ['hwsrc', quoted(v.senderMac)],
          ['psrc', quoted(v.senderIp)],
          ['hwdst', quoted(v.targetMac)],
          ['pdst', quoted(v.targetIp)],
        ])})`,
      ]

    case 'ipv4': {
      const pairs: Array<[string, string]> = [
        ['version', num(v.version)],
        ['ihl', num(v.ihl)],
        // Scapy has a single tos byte: the high 6 bits are DSCP, the low 2 bits ECN
        ['tos', hex(((Number(v.dscp) & 0x3f) << 2) | (Number(v.ecn) & 0x03), 2)],
        ['len', num(v.totalLength)],
        ['id', num(v.identification)],
        // Scapy uses FlagsField("flags", 0, 3, ["MF", "DF", "evil"]), listing the low bit first,
        // so MF=1 and DF=2. Following the left-to-right order of the RFC diagram gets it backwards
        ['flags', num((v.flagDf ? 2 : 0) | (v.flagMf ? 1 : 0))],
        ['frag', num(v.fragmentOffset)],
        ['ttl', num(v.ttl)],
        ['proto', num(v.protocol)],
        ['chksum', hex(v.headerChecksum, 4)],
        ['src', quoted(v.src)],
        ['dst', quoted(v.dst)],
      ]
      const options = v.options instanceof Uint8Array ? v.options : new Uint8Array(0)
      if (options.length > 0) {
        // IP.options is a PacketListField and won't take raw bytes; IPOption can be built from raw bytes
        pairs.push(['options', `[IPOption(${pyBytes(options)})]`])
      }
      return [`IP(${args(pairs)})`]
    }

    case 'tcp': {
      const options = v.options instanceof Uint8Array ? v.options : new Uint8Array(0)
      if (options.length > 0) {
        // Scapy's TCPOptionsField only takes a list of (name, value) pairs and has no way to
        // pass raw bytes through; expressing it correctly would mean decoding the TLVs and
        // mapping option names, which is not implemented. The whole layer falls back to Raw:
        // byte-for-byte correct, just less readable.
        // The preceding IP spells out proto=6, so readers still know it is TCP.
        // In our layer model only payload follows TCP, so consuming the rest skips no other layer
        return [`Raw(load=${pyBytes(packetBytes.slice(layer.offset))})`]
      }

      const flags =
        ((Number(v.reserved) & 1) << 8) |
        (v.flagCwr ? 0x80 : 0) |
        (v.flagEce ? 0x40 : 0) |
        (v.flagUrg ? 0x20 : 0) |
        (v.flagAck ? 0x10 : 0) |
        (v.flagPsh ? 0x08 : 0) |
        (v.flagRst ? 0x04 : 0) |
        (v.flagSyn ? 0x02 : 0) |
        (v.flagFin ? 0x01 : 0)

      return [
        `TCP(${args([
          ['sport', num(v.srcPort)],
          ['dport', num(v.dstPort)],
          ['seq', num(v.seq)],
          ['ack', num(v.ack)],
          ['dataofs', num(v.dataOffset)],
          // Scapy's reserved field has only 3 bits; our 4th bit is its NS flag
          ['reserved', num(Number(v.reserved) >> 1)],
          ['flags', num(flags)],
          ['window', num(v.window)],
          ['chksum', hex(v.checksum, 4)],
          ['urgptr', num(v.urgentPointer)],
        ])})`,
      ]
    }

    case 'icmp': {
      const pairs: Array<[string, string]> = [
        ['type', num(v.type)],
        ['code', num(v.code)],
        ['chksum', hex(v.checksum, 4)],
      ]

      if (ICMP_ID_SEQ_TYPES.includes(Number(v.type))) {
        pairs.push(['id', hex(v.identifier, 4)], ['seq', num(v.sequence)])
        return [`ICMP(${args(pairs)})`]
      }

      // for this type Scapy does not serialize the conditional id / seq fields, so those
      // 4 bytes must be added back with a Raw, or the packet would be 4 bytes short
      const tail = new Uint8Array(4)
      new DataView(tail.buffer).setUint16(0, Number(v.identifier) & 0xffff)
      new DataView(tail.buffer).setUint16(2, Number(v.sequence) & 0xffff)
      return [`ICMP(${args(pairs)})`, `Raw(load=${pyBytes(tail)})`]
    }

    case 'dhcp': {
      const bootp = `BOOTP(${args([
        ['op', num(v.op)],
        ['htype', num(v.htype)],
        ['hlen', num(v.hlen)],
        ['hops', num(v.hops)],
        ['xid', hex(v.xid, 8)],
        ['secs', num(v.secs)],
        ['flags', num(v.flags)],
        ['ciaddr', quoted(v.ciaddr)],
        ['yiaddr', quoted(v.yiaddr)],
        ['siaddr', quoted(v.siaddr)],
        ['giaddr', quoted(v.giaddr)],
        // Scapy's chaddr is a raw 16-byte value, not a MAC string
        ['chaddr', chaddr(v.chaddr)],
        ['sname', pyByteString(v.sname)],
        ['file', pyByteString(v.file)],
      ])})`

      const raw = Array.isArray(v.options) ? v.options : []
      const entries = raw.map((o) => {
        const item = o as { code: number; data: Uint8Array }
        return `(${num(item.code)}, ${pyBytes(item.data)})`
      })
      // the builder appends End (255) automatically; the options list itself doesn't contain it
      entries.push('"end"')

      return [bootp, `DHCP(options=[${entries.join(', ')}])`]
    }

    case 'raw':
      return [`Raw(load=${pyBytes(v.data)})`]

    default:
      throw new Error(`還沒有對應到 Scapy 的層：${layer.layerId}`)
  }
}
