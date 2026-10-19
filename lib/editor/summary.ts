import type { PacketDef } from '../emulator/packet-def'
import { buildPacketDefAt } from '../emulator/packet-def'
import { findLayer } from '../packet/registry'
import type { VariationRule } from '../variation/rules'
import { variationValueAt } from '../variation/rules'
import type { ProjectState } from './project'

export interface PacketDefSummary {
  /**
   * 'Ethernet / IPv4 / UDP'
   *
   * Uses LayerSpec.shortName rather than name: a table column cannot fit a full
   * name like 'Internet Protocol Version 4', and the UI design calls for short names.
   */
  protocolChain: string
  count: number
  /** '—' when there are no rules. */
  variationLabel: string
  /** Length of packet 0; null when it cannot be built. */
  sizeBytes: number | null
  /** Whether any rule changes the packet length. */
  sizeVaries: boolean
}

/** The display name of the field a rule points at. */
function targetLabel(rule: VariationRule): string {
  return 'payload' in rule.target ? rule.target.payload : rule.target.fieldName
}

function describeRule(rule: VariationRule, count: number): string {
  const label = targetLabel(rule)

  if (rule.mode === 'enumerate') {
    const shown = rule.values.slice(0, 3).join(',')
    return `${label}: ${shown}${rule.values.length > 3 ? '…' : ''}`
  }
  if (rule.mode === 'random') {
    return `${label}: ${rule.min}~${rule.max} 隨機`
  }
  const last = variationValueAt(rule, Math.max(0, count - 1))
  return `${label}: ${rule.start}~${last}`
}

/**
 * Compute the columns the list shows.
 *
 * sizeBytes is number | null rather than throwing: the list must always render,
 * and a definition that cannot be built shows a dash instead of breaking the page.
 */
export function summarizePacketDef(def: PacketDef): PacketDefSummary {
  const protocolChain =
    def.layers.length === 0
      ? '原始資料'
      : def.layers.map((l) => findLayer(l.layerId)?.shortName ?? l.layerId).join(' / ')

  let sizeBytes: number | null = null
  try {
    sizeBytes = buildPacketDefAt(def, 0).bytes.length
  } catch {
    sizeBytes = null
  }

  const variationLabel =
    def.variations.length === 0
      ? '—'
      : def.variations.map((r) => describeRule(r, def.count)).join(', ')

  const sizeVaries = def.variations.some(
    (r) => 'payload' in r.target && r.target.payload === 'size',
  )

  return { protocolChain, count: def.count, variationLabel, sizeBytes, sizeVaries }
}

export interface SequenceSummary {
  totalPackets: number
  /** Time span from the first packet to the last. */
  totalDurationMs: number
}

/**
 * Compute the total packet count and duration of the whole send sequence.
 *
 * Pure arithmetic with no packets expanded, which is exactly why
 * EmulatedSequence.length can answer without building any bytes.
 */
export function summarizeSequence(state: ProjectState): SequenceSummary {
  const perLoop = state.main.reduce((sum, item) => {
    const def = state.packetDefs.find((d) => d.id === item.packetDefId)
    // A missing definition means a cascading delete was missed. Count it as 0 instead of
    // throwing: the summary row must always render rather than break the page.
    return sum + (def ? item.repeat * def.count : 0)
  }, 0)

  const totalPackets = state.style.loopCount * perLoop

  // the interval applies between adjacent packets: one packet lasts 0, not one interval
  const totalDurationMs = totalPackets === 0 ? 0 : (totalPackets - 1) * state.style.intervalMs

  return { totalPackets, totalDurationMs }
}
