import { deterministicRandom } from '../variation/random'

export type PayloadPattern = 'zero' | 'incrementing' | 'random'

/**
 * The three ways to specify the innermost payload.
 *
 * pad-to is for frame-size sweeps: the user wants "a 64-byte frame", not
 * "a 64-byte payload".
 */
export type PayloadSpec =
  | { kind: 'bytes'; data: Uint8Array }
  | { kind: 'pattern'; size: number; pattern: PayloadPattern }
  | { kind: 'pad-to'; totalFrameSize: number; pattern: PayloadPattern }

/** How long the payload will be. Only pad-to uses headerLength. */
export function payloadSizeOf(spec: PayloadSpec, headerLength: number): number {
  if (spec.kind === 'bytes') {
    return spec.data.length
  }
  if (spec.kind === 'pattern') {
    return Math.max(0, spec.size)
  }
  // pad-to: use 0 when the headers are longer than the target, never a negative length
  return Math.max(0, spec.totalFrameSize - headerLength)
}

function fill(size: number, pattern: PayloadPattern, seed: number, index: number): Uint8Array {
  const out = new Uint8Array(size)
  if (pattern === 'zero') {
    return out
  }
  if (pattern === 'incrementing') {
    for (let i = 0; i < size; i++) {
      out[i] = i % 256
    }
    return out
  }
  // random: mix index into the seed so every packet gets its own content while
  // staying reproducible for the same packet
  const streamSeed = (seed ^ Math.imul(index, 0x85ebca6b)) >>> 0
  for (let i = 0; i < size; i++) {
    out[i] = deterministicRandom(streamSeed, i) % 256
  }
  return out
}

/**
 * Generate the payload of packet number index.
 *
 * The same (spec, headerLength, seed, index) always returns byte-identical content,
 * because the virtualized list calls this repeatedly and out of order.
 */
export function resolvePayload(
  spec: PayloadSpec,
  headerLength: number,
  seed: number,
  index: number,
): Uint8Array {
  if (spec.kind === 'bytes') {
    return spec.data
  }
  return fill(payloadSizeOf(spec, headerLength), spec.pattern, seed, index)
}
