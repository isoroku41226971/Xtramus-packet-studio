import type { BuiltPacket } from '../packet/build'
import { buildPacket } from '../packet/build'
import type { LayerInstance } from '../packet/model'
import type { VariationRule } from '../variation/rules'
import { variationValueAt } from '../variation/rules'
import type { PayloadSpec } from './payload'
import { resolvePayload } from './payload'

export interface PacketDef {
  id: string
  name: string
  /** The layer list, outermost first. */
  layers: LayerInstance[]
  payload: PayloadSpec
  /** How many packets this definition expands into. */
  count: number
  /** Zero or more variation rules, advancing in lockstep. */
  variations: VariationRule[]
  /** The raw bytes kept when an imported packet cannot be decoded. */
  raw?: Uint8Array
}

const EMPTY = new Uint8Array(0)

/**
 * Fixed seed for the random payload pattern.
 *
 * PayloadSpec has no seed field; the content varies only with the packet index.
 * This constant just gives the (seed, index) interface an explicit seed, instead
 * of passing index twice, which would look like a typo.
 */
const PAYLOAD_SEED = 0x50415944

/** Apply field-targeted variations and return a new layer list (the original is untouched). */
function applyFieldVariations(
  layers: LayerInstance[],
  variations: VariationRule[],
  index: number,
): LayerInstance[] {
  const fieldRules = variations.filter((r) => 'instanceId' in r.target)
  if (fieldRules.length === 0) {
    return layers
  }

  const next = layers.map((l) => ({ ...l, fields: { ...l.fields } }))
  for (const rule of fieldRules) {
    const target = rule.target as { instanceId: string; fieldName: string }
    const layer = next.find((l) => l.instanceId === target.instanceId)
    if (!layer) {
      throw new Error(`變化規則指向不存在的層：${target.instanceId}`)
    }
    // a value produced by a variation is always manual: it is exactly the number the user asked for
    layer.fields[target.fieldName] = {
      mode: 'manual',
      value: variationValueAt(rule, index),
    }
  }
  return next
}

/** Apply payload-length variations and return a new PayloadSpec. */
function applyPayloadVariation(
  payload: PayloadSpec,
  variations: VariationRule[],
  index: number,
): PayloadSpec {
  const rule = variations.find(
    (r) => 'payload' in r.target && r.target.payload === 'size',
  )
  if (!rule) {
    return payload
  }
  const size = variationValueAt(rule, index)
  if (typeof size !== 'number') {
    throw new Error(`payload 長度的變化必須產生數值，收到：${String(size)}`)
  }
  if (payload.kind === 'pattern') {
    return { ...payload, size }
  }
  if (payload.kind === 'pad-to') {
    return { ...payload, totalFrameSize: size }
  }
  // bytes content is fixed, so there is no length to adjust
  return payload
}

/**
 * Build packet number index of this definition's expansion.
 *
 * **This is a pure function**: the same (def, index) always yields byte-identical
 * results, and the def passed in is never modified. The virtualized list calls it
 * repeatedly and out of order.
 */
export function buildPacketDefAt(def: PacketDef, index: number): BuiltPacket {
  // an imported packet that cannot be decoded is output as-is; variation rules have nothing to apply to
  if (def.layers.length === 0) {
    if (!def.raw) {
      throw new Error(`封包定義 ${def.id} 既沒有層也沒有原始 bytes`)
    }
    return { bytes: def.raw, layers: [], payloadOffset: 0 }
  }

  const layers = applyFieldVariations(def.layers, def.variations, index)
  const payloadSpec = applyPayloadVariation(def.payload, def.variations, index)

  // Build once with an empty payload to measure the header length.
  // This is safe: the header's byte length does not depend on the payload length
  // (the value of IPv4's Total Length changes, but not the size of the field).
  const headerLength = buildPacket(layers, EMPTY).payloadOffset

  const payload = resolvePayload(payloadSpec, headerLength, PAYLOAD_SEED, index)
  return buildPacket(layers, payload)
}
