import {
  ipv4ToNumber,
  macToNumber,
  numberToIpv4,
  numberToMac,
} from '../packet/format'
import { randomInRange } from './random'

/** The values a variation rule can produce: numbers, or MAC / IPv4 address strings. */
export type VariationValue = number | string

/** Where a variation applies. */
export type VariationScope =
  | { instanceId: string; fieldName: string }
  | { payload: 'size' }

/**
 * One variation rule.
 *
 * A discriminated union on mode rather than a loose bag of params, so each mode's
 * required fields are required at the type level.
 */
export type VariationRule =
  | {
      target: VariationScope
      mode: 'increment' | 'decrement'
      start: VariationValue
      step: number
    }
  | { target: VariationScope; mode: 'enumerate'; values: VariationValue[] }
  | { target: VariationScope; mode: 'random'; min: number; max: number; seed: number }

/**
 * Add a delta to a value. The value's type is decided by its runtime shape: numbers
 * are added directly; strings with colons are MACs (wrapping at 2^48); strings with
 * dots are IPv4 addresses (wrapping at 2^32).
 */
function addToValue(base: VariationValue, delta: number): VariationValue {
  if (typeof base === 'number') {
    return base + delta
  }
  if (base.includes(':')) {
    return numberToMac(macToNumber(base) + delta)
  }
  if (base.includes('.')) {
    return numberToIpv4(ipv4ToNumber(base) + delta)
  }
  throw new Error(`無法對這個值做加減，它既不是數值也不是 MAC / IPv4 位址：${base}`)
}

/** Compute a rule's value for packet number index. */
export function variationValueAt(rule: VariationRule, index: number): VariationValue {
  if (rule.mode === 'enumerate') {
    if (rule.values.length === 0) {
      throw new Error('列舉模式的值清單不可為空')
    }
    // wrap around past the end of the list instead of sticking at the last item
    return rule.values[index % rule.values.length]
  }

  if (rule.mode === 'random') {
    return randomInRange(rule.seed, index, rule.min, rule.max)
  }

  const delta = rule.step * index
  if (delta === 0) {
    // packet 0 is the start value, so no type detection is needed
    return rule.start
  }
  return addToValue(rule.start, rule.mode === 'increment' ? delta : -delta)
}
