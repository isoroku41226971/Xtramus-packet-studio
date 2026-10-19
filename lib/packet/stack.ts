import type { LayerInstance } from './model'
import { findLayer } from './registry'

export interface Warning {
  severity: 'info' | 'warning'
  scope: { instanceId?: string }
  message: string
}

/**
 * Whether this layer can be inserted into the stack right now.
 *
 * The editor's left-pane "insert layer" menu uses this to grey out entries.
 * Non-repeatable layers (IPv4, TCP, ...) are blocked once present; the repeatable
 * VLAN layer has no limit.
 */
export function canInsertLayer(layers: LayerInstance[], layerId: string): boolean {
  return insertBlockedReason(layers, layerId) === null
}

/** The reason text when insertion is not allowed; null when it is. */
export function insertBlockedReason(layers: LayerInstance[], layerId: string): string | null {
  const spec = findLayer(layerId)
  if (!spec) {
    return `未知的層：${layerId}`
  }
  if (spec.stackable) {
    return null
  }
  if (layers.some((l) => l.layerId === layerId)) {
    return `${spec.name} 不能重複出現在同一個封包裡`
  }
  return null
}

/**
 * Check an existing stack and report problems.
 *
 * It only reports and never modifies: following the "warn, don't block" principle,
 * a packet that has been built is never changed automatically.
 */
export function validateStack(layers: LayerInstance[]): Warning[] {
  const warnings: Warning[] = []
  const seen = new Set<string>()

  for (const instance of layers) {
    const spec = findLayer(instance.layerId)
    if (!spec) {
      warnings.push({
        severity: 'warning',
        scope: { instanceId: instance.instanceId },
        message: `未知的層：${instance.layerId}`,
      })
      continue
    }
    if (!spec.stackable && seen.has(instance.layerId)) {
      warnings.push({
        severity: 'warning',
        scope: { instanceId: instance.instanceId },
        message: `${spec.name} 重複出現在同一個封包裡`,
      })
    }
    seen.add(instance.layerId)
  }

  return warnings
}
