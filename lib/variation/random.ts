/**
 * A pseudo-random number determined by (seed, index), from 0 to 2^32-1.
 *
 * **It must be a pure function.** The virtualized list calls it repeatedly and out
 * of order for the same index; with Math.random() or a stateful generator the same
 * packet would show different content every time.
 *
 * The algorithm is a 32-bit splitmix-family mixer: combine seed and index into one
 * word, then do three rounds of "shift-xor + multiply". Math.imul is used instead
 * of * because a 32-bit multiplication with * exceeds float precision and loses bits.
 */
export function deterministicRandom(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  return (x ^ (x >>> 15)) >>> 0
}

/** Map the deterministic random number onto the closed interval [min, max]. */
export function randomInRange(
  seed: number,
  index: number,
  min: number,
  max: number,
): number {
  const span = max - min + 1
  if (span <= 1) {
    return min
  }
  return min + (deterministicRandom(seed, index) % span)
}
