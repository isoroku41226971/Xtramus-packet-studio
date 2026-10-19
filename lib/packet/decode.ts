import { findLayer } from './registry'

export interface DecodedLayer {
  layerId: string
  values: Record<string, unknown>
  offset: number
  length: number
}

export interface DecodedPacket {
  layers: DecodedLayer[]
  payload: Uint8Array
  payloadOffset: number
  /** true means decoding stopped early and the content after this layer was not decoded. */
  truncated: boolean
  /**
   * When truncated is true, the reason decoding stopped.
   *
   * It is recorded because the catch block cannot tell "not enough bytes" from
   * "a bug in our implementation"; both become truncated. Without this message an
   * implementation error masquerades as incomplete data and sends debugging in
   * completely the wrong direction.
   */
  error?: string
}

/**
 * Decode layer by layer starting from firstLayerId.
 *
 * There are three stop conditions, none of them errors:
 *  - a layer reports nextLayerId as null (the rest is payload)
 *  - nextLayerId names an unregistered layer (unknown protocol, treated as payload)
 *  - the bytes run out (marked truncated)
 *
 * This function never throws: when importing a real capture, one bad packet must
 * not abort the whole batch.
 */
export function decodePacket(bytes: Uint8Array, firstLayerId = 'ethernet'): DecodedPacket {
  const layers: DecodedLayer[] = []
  let offset = 0
  let currentLayerId: string | null = firstLayerId
  let truncated = false
  let error: string | undefined

  while (currentLayerId !== null) {
    const spec = findLayer(currentLayerId)
    if (!spec) {
      // unknown protocol: the remaining bytes become payload. A normal fallback, not an error.
      break
    }
    if (offset >= bytes.length) {
      truncated = true
      error = `解碼 ${currentLayerId} 時 bytes 已用盡（offset ${offset}／總長 ${bytes.length}）`
      break
    }
    try {
      const result = spec.decode(bytes, offset)
      layers.push({
        layerId: currentLayerId,
        values: result.values,
        offset,
        length: result.consumed,
      })
      offset += result.consumed
      currentLayerId = result.nextLayerId
    } catch (e) {
      truncated = true
      error = `解碼 ${currentLayerId} 失敗：${e instanceof Error ? e.message : String(e)}`
      break
    }
  }

  return {
    layers,
    payload: bytes.slice(offset),
    payloadOffset: offset,
    truncated,
    error,
  }
}
