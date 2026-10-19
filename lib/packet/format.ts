export function parseMac(s: string): Uint8Array {
  const parts = s.trim().split(':')
  if (parts.length !== 6) {
    throw new Error(`MAC 位址需要 6 段，收到 ${parts.length} 段：${s}`)
  }
  const out = new Uint8Array(6)
  parts.forEach((p, i) => {
    if (!/^[0-9a-fA-F]{1,2}$/.test(p)) {
      throw new Error(`MAC 位址第 ${i + 1} 段不是有效的十六進位：${p}`)
    }
    out[i] = parseInt(p, 16)
  })
  return out
}

export function formatMac(bytes: Uint8Array, offset = 0): string {
  const parts: string[] = []
  for (let i = 0; i < 6; i++) {
    parts.push(bytes[offset + i].toString(16).padStart(2, '0'))
  }
  return parts.join(':')
}

export function parseIpv4(s: string): Uint8Array {
  const parts = s.trim().split('.')
  if (parts.length !== 4) {
    throw new Error(`IPv4 位址需要 4 段，收到 ${parts.length} 段：${s}`)
  }
  const out = new Uint8Array(4)
  parts.forEach((p, i) => {
    // leading zeros are ambiguous between octal and decimal (see CVE-2021-29921), so they are always rejected
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p)) {
      throw new Error(`IPv4 位址第 ${i + 1} 段格式無效：${p}`)
    }
    const n = Number(p)
    if (n > 255) {
      throw new Error(`IPv4 位址第 ${i + 1} 段超出範圍：${p}`)
    }
    out[i] = n
  })
  return out
}

export function formatIpv4(bytes: Uint8Array, offset = 0): string {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`
}

const MAC_MODULUS = 2 ** 48
const IPV4_MODULUS = 2 ** 32

/**
 * Convert a MAC address to a 48-bit number so variation rules can add and subtract.
 *
 * Uses multiplication, division and remainder only, never bitwise operators:
 * JavaScript converts bitwise operands to 32-bit signed integers, which would
 * truncate a 48-bit value.
 */
export function macToNumber(mac: string): number {
  const bytes = parseMac(mac)
  let value = 0
  for (const b of bytes) {
    value = value * 256 + b
  }
  return value
}

/** Convert a 48-bit number back to a MAC string; out-of-range values wrap around (like an odometer). */
export function numberToMac(value: number): string {
  let remaining = ((value % MAC_MODULUS) + MAC_MODULUS) % MAC_MODULUS
  const parts: string[] = []
  for (let i = 0; i < 6; i++) {
    parts.unshift((remaining % 256).toString(16).padStart(2, '0'))
    remaining = Math.floor(remaining / 256)
  }
  return parts.join(':')
}

/** Convert an IPv4 address to a 32-bit number. */
export function ipv4ToNumber(ip: string): number {
  const bytes = parseIpv4(ip)
  return bytes[0] * 2 ** 24 + bytes[1] * 2 ** 16 + bytes[2] * 256 + bytes[3]
}

/** Convert a 32-bit number back to an IPv4 string; out-of-range values wrap around. */
export function numberToIpv4(value: number): string {
  let remaining = ((value % IPV4_MODULUS) + IPV4_MODULUS) % IPV4_MODULUS
  const parts: number[] = []
  for (let i = 0; i < 4; i++) {
    parts.unshift(remaining % 256)
    remaining = Math.floor(remaining / 256)
  }
  return parts.join('.')
}
