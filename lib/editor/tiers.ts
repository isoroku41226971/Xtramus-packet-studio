import type { LayerInstance } from '../packet/model'
import { getLayer } from '../packet/registry'

export type NetworkTier = 'none' | 'ipv4' | 'arp' | 'raw'
export type TransportTier = 'none' | 'tcp' | 'udp' | 'icmp' | 'igmp' | 'raw'
export type ApplicationTier = 'none' | 'dhcp' | 'raw'

/**
 * The selections in the five tier blocks.
 *
 * This is another view of def.layers, not a new source of data: after selection
 * it converts back to the same LayerInstance[].
 */
export interface TierSelection {
  vlanCount: 0 | 1 | 2
  network: NetworkTier
  transport: TransportTier
  application: ApplicationTier
}

const NETWORK_LAYERS: readonly string[] = ['ipv4', 'arp']
const TRANSPORT_LAYERS: readonly string[] = ['tcp', 'udp', 'icmp', 'igmp']
const APPLICATION_LAYERS: readonly string[] = ['dhcp']

/**
 * Convert tier selections into a layer list.
 *
 * existing carries over current field values: when the user switches the
 * application layer from "none" to DHCP, the already-filled IPv4 and UDP fields
 * must not be reset.
 */
export function tiersToLayers(tiers: TierSelection, existing: LayerInstance[]): LayerInstance[] {
  // layers of the same type queue up in order; the nth new layer reuses the fields of the nth old one
  const pool = new Map<string, LayerInstance[]>()
  for (const layer of existing) {
    const list = pool.get(layer.layerId) ?? []
    list.push(layer)
    pool.set(layer.layerId, list)
  }

  const used = new Map<string, number>()
  const out: LayerInstance[] = []

  function push(layerId: string): void {
    const n = used.get(layerId) ?? 0
    used.set(layerId, n + 1)
    const reused = pool.get(layerId)?.[n]
    out.push({
      instanceId: `${layerId}-${out.length}`,
      layerId,
      fields: reused ? reused.fields : getLayer(layerId).defaults(),
    })
  }

  push('ethernet')
  for (let i = 0; i < tiers.vlanCount; i++) {
    push('vlan')
  }

  if (tiers.network === 'none') {
    return out
  }
  push(tiers.network)
  // raw and arp both end the stack; deeper blocks have no effect
  if (tiers.network === 'raw' || tiers.network === 'arp') {
    return out
  }

  if (tiers.transport === 'none') {
    return out
  }
  push(tiers.transport)
  if (tiers.transport === 'raw') {
    return out
  }

  if (tiers.application !== 'none') {
    push(tiers.application)
  }
  return out
}

/**
 * Convert a layer list back into tier selections.
 *
 * A stack the tiers cannot express (e.g. IPv4 inside IPv4) returns the closest
 * approximation instead of throwing: the editor must always open, and an unusual
 * stack must not break the page.
 */
export function layersToTiers(layers: LayerInstance[]): TierSelection {
  const tiers: TierSelection = {
    vlanCount: 0,
    network: 'none',
    transport: 'none',
    application: 'none',
  }

  for (const layer of layers) {
    const id = layer.layerId

    if (id === 'ethernet') {
      continue
    }
    if (id === 'vlan') {
      // clamp to 2 beyond two layers: the tier model goes up to Q-in-Q only
      tiers.vlanCount = Math.min(2, tiers.vlanCount + 1) as 0 | 1 | 2
      continue
    }

    // raw can appear anywhere: put it in the outermost block not yet filled
    if (id === 'raw') {
      if (tiers.network === 'none') {
        tiers.network = 'raw'
      } else if (tiers.transport === 'none') {
        tiers.transport = 'raw'
      } else if (tiers.application === 'none') {
        tiers.application = 'raw'
      }
      continue
    }

    if (NETWORK_LAYERS.includes(id) && tiers.network === 'none') {
      tiers.network = id as NetworkTier
    } else if (TRANSPORT_LAYERS.includes(id) && tiers.transport === 'none') {
      tiers.transport = id as TransportTier
    } else if (APPLICATION_LAYERS.includes(id) && tiers.application === 'none') {
      tiers.application = id as ApplicationTier
    }
    // 認不得或位置已被佔用的層直接忽略——這就是「近似值」
  }

  return tiers
}
