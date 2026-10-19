'use client'

import { Listbox } from '@/components/Listbox'
import type { TierSelection } from '@/lib/editor/tiers'
import { layersToTiers, tiersToLayers } from '@/lib/editor/tiers'
import type { PacketDef } from '@/lib/emulator/packet-def'

interface Props {
  def: PacketDef
  selected: number
  onSelect: (index: number) => void
  onChange: (def: PacketDef) => void
}

interface TierOption {
  value: string
  label: string
}

const NETWORK_OPTIONS: TierOption[] = [
  { value: 'none', label: '無' },
  { value: 'ipv4', label: 'IPv4' },
  { value: 'arp', label: 'ARP' },
  { value: 'raw', label: '自訂資料' },
]

const TRANSPORT_OPTIONS: TierOption[] = [
  { value: 'none', label: '無' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'igmp', label: 'IGMP' },
  { value: 'raw', label: '自訂資料' },
]

const VLAN_OPTIONS: TierOption[] = [
  { value: '0', label: '無' },
  { value: '1', label: '1 層' },
  { value: '2', label: '2 層（Q-in-Q）' },
]

export function LayerStack({ def, selected, onSelect, onChange }: Props) {
  const tiers = layersToTiers(def.layers)

  function apply(next: TierSelection): void {
    onChange({ ...def, layers: tiersToLayers(next, def.layers) })
    // the layer count may have shrunk, so pull the selection back into range
    onSelect(0)
  }

  // ARP and custom data both end the stack; deeper blocks have no effect
  const networkEnds = tiers.network === 'arp' || tiers.network === 'raw'
  const transportEnabled = tiers.network !== 'none' && !networkEnds
  const applicationEnabled =
    transportEnabled && tiers.transport !== 'none' && tiers.transport !== 'raw'

  // DHCP runs over UDP ports 67/68; other transports have no matching application protocol
  const applicationOptions: TierOption[] = [
    { value: 'none', label: '無' },
    ...(tiers.transport === 'udp' ? [{ value: 'dhcp', label: 'DHCP' }] : []),
    { value: 'raw', label: '自訂資料' },
  ]

  /** Each layer's index in def.layers, used to switch which layer the middle pane shows on click. */
  function indexOfLayer(layerId: string): number {
    const i = def.layers.findIndex((l) => l.layerId === layerId)
    return i === -1 ? 0 : i
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="text-xs opacity-60">封包分層</div>

      <TierBlock
        label="連結層"
        options={[{ value: 'ethernet', label: 'Ethernet' }]}
        value="ethernet"
        disabled
        active={selected === indexOfLayer('ethernet')}
        onSelectBlock={() => onSelect(indexOfLayer('ethernet'))}
        onChange={() => {}}
      />

      <TierBlock
        label="VLAN 標籤"
        options={VLAN_OPTIONS}
        value={String(tiers.vlanCount)}
        active={tiers.vlanCount > 0 && selected === indexOfLayer('vlan')}
        onSelectBlock={() => tiers.vlanCount > 0 && onSelect(indexOfLayer('vlan'))}
        onChange={(v) => apply({ ...tiers, vlanCount: Number(v) as 0 | 1 | 2 })}
      />

      <TierBlock
        label="網路層"
        options={NETWORK_OPTIONS}
        value={tiers.network}
        active={tiers.network !== 'none' && selected === indexOfLayer(tiers.network)}
        onSelectBlock={() => tiers.network !== 'none' && onSelect(indexOfLayer(tiers.network))}
        onChange={(v) => apply({ ...tiers, network: v as TierSelection['network'] })}
      />

      <TierBlock
        label="傳輸層"
        options={TRANSPORT_OPTIONS}
        value={transportEnabled ? tiers.transport : 'none'}
        disabled={!transportEnabled}
        active={
          transportEnabled && tiers.transport !== 'none' && selected === indexOfLayer(tiers.transport)
        }
        onSelectBlock={() =>
          transportEnabled && tiers.transport !== 'none' && onSelect(indexOfLayer(tiers.transport))
        }
        onChange={(v) => apply({ ...tiers, transport: v as TierSelection['transport'] })}
      />

      <TierBlock
        label="應用層"
        options={applicationOptions}
        value={applicationEnabled ? tiers.application : 'none'}
        disabled={!applicationEnabled}
        active={
          applicationEnabled &&
          tiers.application !== 'none' &&
          selected === indexOfLayer(tiers.application)
        }
        onSelectBlock={() =>
          applicationEnabled &&
          tiers.application !== 'none' &&
          onSelect(indexOfLayer(tiers.application))
        }
        onChange={(v) => apply({ ...tiers, application: v as TierSelection['application'] })}
      />
    </div>
  )
}

function TierBlock({
  label,
  options,
  value,
  disabled = false,
  active,
  onSelectBlock,
  onChange,
}: {
  label: string
  options: TierOption[]
  value: string
  disabled?: boolean
  active: boolean
  onSelectBlock: () => void
  onChange: (value: string) => void
}) {
  return (
    <div
      onClick={onSelectBlock}
      className={`rounded border px-3 py-2 transition ${
        active ? 'border-brand/60 bg-brand/[10%]' : 'border-current/15'
      } ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-current/5'}`}
    >
      <div className="mb-1 text-xs opacity-60">{label}</div>
      <div onClick={(e) => e.stopPropagation()}>
        <Listbox options={options} value={value} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  )
}
