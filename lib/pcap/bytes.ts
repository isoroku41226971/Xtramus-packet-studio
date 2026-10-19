/**
 * Accumulates bytes piece by piece, **always little-endian**.
 *
 * Writing always uses little-endian (the x86 convention), so the methods take no
 * byte-order parameter. Reading must support both byte orders and uses the
 * built-in DataView instead.
 */
export class ByteWriter {
  private readonly chunks: Uint8Array[] = []
  private total = 0

  get length(): number {
    return this.total
  }

  u8(value: number): this {
    return this.push(new Uint8Array([value & 0xff]))
  }

  u16(value: number): this {
    return this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]))
  }

  u32(value: number): this {
    return this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    )
  }

  /** Split into two 32-bit words, low word first (pcapng timestamp and length fields). */
  u64(value: number): this {
    const low = value >>> 0
    const high = Math.floor(value / 2 ** 32)
    return this.u32(low).u32(high)
  }

  bytes(data: Uint8Array): this {
    return this.push(data)
  }

  /** Zero-pad to a multiple of 4; pcapng requires packet data to be aligned. */
  padTo4(): this {
    const remainder = this.total % 4
    if (remainder === 0) {
      return this
    }
    return this.push(new Uint8Array(4 - remainder))
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.total)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  private push(chunk: Uint8Array): this {
    this.chunks.push(chunk)
    this.total += chunk.length
    return this
  }
}
