import type { BuildCtx, LayerInstance } from './model'
import { getLayer } from './registry'

export interface BuiltLayer {
  layerId: string
  instanceId: string
  values: Record<string, unknown>
  /** Where this layer starts in the whole packet's bytes. */
  offset: number
  length: number
}

export interface BuiltPacket {
  bytes: Uint8Array
  /** Outermost first, in the same order as the layers passed in. */
  layers: BuiltLayer[]
  payloadOffset: number
}

/**
 * Build a complete packet from a layer list and a payload.
 *
 * The layer list runs outermost first, but serialization runs innermost first:
 * outer layers need the inner lengths (IPv4 Total Length, UDP Length), so inner
 * layers must be built first.
 */
export function buildPacket(layers: LayerInstance[], payload: Uint8Array): BuiltPacket {
  if (layers.length === 0) {
    throw new Error('封包至少要有一層')
  }

  // each layer's resolved values, indexed like layers
  const resolved = new Map<number, Record<string, unknown>>()
  const chunks: Uint8Array[] = []
  let inner = payload

  for (let i = layers.length - 1; i >= 0; i--) {
    const instance = layers[i]
    const spec = getLayer(instance.layerId)
    const ctx: BuildCtx = { layers, index: i, inner }
    const output = spec.build(instance.fields, ctx)

    resolved.set(i, output.values)
    chunks[i] = output.bytes
    // the inner bytes seen by the next (outer) round must include this layer
    const merged = new Uint8Array(output.bytes.length + inner.length)
    merged.set(output.bytes, 0)
    merged.set(inner, output.bytes.length)
    inner = merged
  }

  const bytes = inner
  const built: BuiltLayer[] = []
  let offset = 0
  for (let i = 0; i < layers.length; i++) {
    built.push({
      layerId: layers[i].layerId,
      instanceId: layers[i].instanceId,
      values: resolved.get(i) as Record<string, unknown>,
      offset,
      length: chunks[i].length,
    })
    offset += chunks[i].length
  }

  return { bytes, layers: built, payloadOffset: offset }
}
