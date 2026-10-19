/**
 * RFC 1071 Internet checksum.
 *
 * Sums the input as consecutive 16-bit big-endian words (with end-around carry),
 * then takes the one's complement. An odd length is treated as padded with a zero byte.
 *
 * Invariant: if the input already contains a correct checksum field, the result is 0.
 */
export function internetChecksum(bytes: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < bytes.length - 1; i += 2) {
    sum += (bytes[i] << 8) | bytes[i + 1]
  }
  if (bytes.length % 2 === 1) {
    sum += bytes[bytes.length - 1] << 8
  }
  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >>> 16)
  }
  return (~sum) & 0xffff
}

/**
 * IPv4 pseudo-header (RFC 768 / RFC 793) used by the UDP and TCP checksums.
 * payloadLength is the length of the transport header plus its payload, excluding the IP header.
 */
export function ipv4PseudoHeader(
  srcBytes: Uint8Array,
  dstBytes: Uint8Array,
  protocol: number,
  payloadLength: number,
): Uint8Array {
  const out = new Uint8Array(12)
  out.set(srcBytes, 0)
  out.set(dstBytes, 4)
  out[8] = 0
  out[9] = protocol
  out[10] = (payloadLength >>> 8) & 0xff
  out[11] = payloadLength & 0xff
  return out
}
