import type { PacketDef } from '../emulator/packet-def'
import { getLayer } from '../packet/registry'

/** Clamp to [0, max]. */
function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}

/**
 * Generate an instanceId not yet used in this stack.
 *
 * Templates use "layer id + position", but positions collide on insert: a layer
 * inserted before ipv4-1 would also want to be called xxx-1. So this searches
 * upward from 0 instead.
 */
export function nextInstanceId(def: PacketDef, layerId: string): string {
  const used = new Set(def.layers.map((l) => l.instanceId))
  let n = 0
  while (used.has(`${layerId}-${n}`)) {
    n += 1
  }
  return `${layerId}-${n}`
}

export function insertLayerAt(def: PacketDef, layerId: string, position: number): PacketDef {
  const spec = getLayer(layerId)
  const layers = [...def.layers]
  layers.splice(clamp(position, layers.length), 0, {
    instanceId: nextInstanceId(def, layerId),
    layerId,
    fields: spec.defaults(),
  })
  return { ...def, layers }
}

/**
 * Remove a layer together with the variation rules that point at it.
 *
 * Without removing those rules, buildPacketDefAt would throw "variation rule
 * points to a missing layer" and break the whole editor; this is part of
 * deleting, not an extra feature.
 */
export function removeLayerAt(def: PacketDef, position: number): PacketDef {
  if (position < 0 || position >= def.layers.length) {
    throw new Error(`層的位置超出範圍：${position}`)
  }
  const removed = def.layers[position]
  const layers = [...def.layers]
  layers.splice(position, 1)

  const variations = def.variations.filter(
    (r) => !('instanceId' in r.target) || r.target.instanceId !== removed.instanceId,
  )

  return { ...def, layers, variations }
}

/** Reorder layers. instanceIds don't change, so variation rules still point to the right layers. */
export function moveLayer(def: PacketDef, from: number, to: number): PacketDef {
  if (from < 0 || from >= def.layers.length) {
    throw new Error(`來源位置超出範圍：${from}`)
  }
  const layers = [...def.layers]
  const [moved] = layers.splice(from, 1)
  layers.splice(clamp(to, layers.length), 0, moved)
  return { ...def, layers }
}
