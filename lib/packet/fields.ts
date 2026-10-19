import type { FieldValue } from './model'

/**
 * Resolve a single field's value: a manual value wins, otherwise it is computed automatically.
 *
 * This is the one place that implements the rule "every auto-computed field can be
 * overridden". A manual value may be 0, '' or false, so the decision is based on
 * mode, not on the value's truthiness.
 */
export function manualOr<T>(field: FieldValue | undefined, computeAuto: () => T): T {
  if (field && field.mode === 'manual') {
    return field.value as T
  }
  return computeAuto()
}
