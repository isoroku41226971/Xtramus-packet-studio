import type { PacketDef } from '../emulator/packet-def'
import type { VariationRule, VariationScope, VariationValue } from '../variation/rules'

function sameTarget(a: VariationScope, b: VariationScope): boolean {
  if ('payload' in a) {
    return 'payload' in b && a.payload === b.payload
  }
  return 'instanceId' in b && a.instanceId === b.instanceId && a.fieldName === b.fieldName
}

/** Whether this value can be incremented/decremented: numbers, MACs and IPv4 addresses can. */
function canIncrement(value: unknown): value is VariationValue {
  if (typeof value === 'number') {
    return true
  }
  return typeof value === 'string' && (value.includes(':') || value.includes('.'))
}

/**
 * Produce a sensible default rule when the user presses "vary" next to a field.
 *
 * The start value is the field's current value for the user to adjust, which is
 * far more usable than an empty form.
 *
 * null means the field does not support variation. VariationValue is only
 * number | string, so boolean flags and byte fields genuinely cannot vary; forcing
 * them would take an `as VariationValue` cast that fools the type checker and
 * only defers the error to run time. Returning null lets the middle pane hide the
 * button altogether.
 */
export function defaultVariationFor(
  target: VariationScope,
  currentValue: unknown,
): VariationRule | null {
  if (!canIncrement(currentValue)) {
    return null
  }
  return { target, mode: 'increment', start: currentValue, step: 1 }
}

export function findVariationFor(
  def: PacketDef,
  target: VariationScope,
): { rule: VariationRule; index: number } | undefined {
  const index = def.variations.findIndex((r) => sameTarget(r.target, target))
  return index === -1 ? undefined : { rule: def.variations[index], index }
}

/** One rule per target: adding another replaces the old one. */
export function addVariation(def: PacketDef, rule: VariationRule): PacketDef {
  const existing = findVariationFor(def, rule.target)
  if (existing) {
    return updateVariation(def, existing.index, rule)
  }
  return { ...def, variations: [...def.variations, rule] }
}

export function updateVariation(def: PacketDef, index: number, rule: VariationRule): PacketDef {
  if (index < 0 || index >= def.variations.length) {
    throw new Error(`變化規則的索引超出範圍：${index}`)
  }
  const variations = [...def.variations]
  variations[index] = rule
  return { ...def, variations }
}

export function removeVariation(def: PacketDef, index: number): PacketDef {
  if (index < 0 || index >= def.variations.length) {
    throw new Error(`變化規則的索引超出範圍：${index}`)
  }
  const variations = [...def.variations]
  variations.splice(index, 1)
  return { ...def, variations }
}

/** The count is at least 1: a packet definition with 0 packets makes no sense. */
export function setCount(def: PacketDef, count: number): PacketDef {
  return { ...def, count: Math.max(1, Math.floor(count)) }
}
