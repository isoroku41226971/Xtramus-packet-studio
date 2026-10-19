import type { PacketDef } from '../emulator/packet-def'
import type { PayloadSpec } from '../emulator/payload'
import type { FieldValue, LayerInstance } from '../packet/model'
import { getLayer } from '../packet/registry'

export interface PacketTemplate {
  id: string
  name: string
  description: string
  /** When true, it appears in the quick-access button row on the workspace's build tab. */
  quickAccess: boolean
  /** Layers from outermost to innermost. */
  layerIds: string[]
  /** Overrides for a layer's default fields, keyed by layerId. */
  overrides?: Record<string, Record<string, FieldValue>>
  payload?: PayloadSpec
}

const m = (value: unknown): FieldValue => ({ mode: 'manual', value })

/** The DHCP message type option (code 53). */
function dhcpMessageType(value: number): Record<string, FieldValue> {
  return { options: m([{ code: 53, data: new Uint8Array([value]) }]) }
}

/**
 * Built-in templates.
 *
 * Those with quickAccess appear in the quick-access button row on the workspace's build tab,
 * and all of them appear in the template picker: one list, shown two ways.
 */
export const TEMPLATES: PacketTemplate[] = [
  {
    id: 'ethernet-raw',
    name: 'Ethernet + 自訂資料',
    description: '只有 Ethernet 標頭，內容自己填',
    quickAccess: true,
    layerIds: ['ethernet', 'raw'],
    // raw has no matching EtherType to infer, so it must be set manually
    overrides: { ethernet: { etherType: m(0x0800) } },
  },
  {
    id: 'ipv4-udp',
    name: 'IPv4 / UDP',
    description: '最常見的 UDP 封包',
    quickAccess: true,
    layerIds: ['ethernet', 'ipv4', 'udp'],
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
  {
    id: 'ipv4-tcp',
    name: 'IPv4 / TCP',
    description: 'TCP 封包，預設帶 SYN 旗標',
    quickAccess: true,
    layerIds: ['ethernet', 'ipv4', 'tcp'],
  },
  {
    id: 'ipv4-icmp',
    name: 'IPv4 / ICMP',
    description: 'ICMP 封包',
    quickAccess: true,
    layerIds: ['ethernet', 'ipv4', 'icmp'],
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
  {
    id: 'arp-request',
    name: 'ARP Request',
    description: '詢問某個 IP 對應的 MAC',
    quickAccess: true,
    layerIds: ['ethernet', 'arp'],
    overrides: {
      ethernet: { dst: m('ff:ff:ff:ff:ff:ff') },
      arp: { opcode: m(1) },
    },
  },
  {
    id: 'arp-reply',
    name: 'ARP Reply',
    description: '回覆 ARP 查詢',
    quickAccess: false,
    layerIds: ['ethernet', 'arp'],
    overrides: { arp: { opcode: m(2) } },
  },
  {
    id: 'dhcp-discover',
    name: 'DHCP Discover',
    description: '用戶端尋找 DHCP 伺服器',
    quickAccess: true,
    layerIds: ['ethernet', 'ipv4', 'udp', 'dhcp'],
    overrides: {
      ethernet: { dst: m('ff:ff:ff:ff:ff:ff') },
      ipv4: { src: m('0.0.0.0'), dst: m('255.255.255.255') },
      udp: { srcPort: m(68), dstPort: m(67) },
      dhcp: { op: m(1), ...dhcpMessageType(1) },
    },
  },
  {
    id: 'dhcp-offer',
    name: 'DHCP Offer',
    description: '伺服器提供位址',
    quickAccess: false,
    layerIds: ['ethernet', 'ipv4', 'udp', 'dhcp'],
    overrides: {
      udp: { srcPort: m(67), dstPort: m(68) },
      dhcp: { op: m(2), ...dhcpMessageType(2) },
    },
  },
  {
    id: 'dhcp-request',
    name: 'DHCP Request',
    description: '用戶端請求指定位址',
    quickAccess: false,
    layerIds: ['ethernet', 'ipv4', 'udp', 'dhcp'],
    overrides: {
      ethernet: { dst: m('ff:ff:ff:ff:ff:ff') },
      ipv4: { src: m('0.0.0.0'), dst: m('255.255.255.255') },
      udp: { srcPort: m(68), dstPort: m(67) },
      dhcp: { op: m(1), ...dhcpMessageType(3) },
    },
  },
  {
    id: 'dhcp-ack',
    name: 'DHCP ACK',
    description: '伺服器確認配發',
    quickAccess: false,
    layerIds: ['ethernet', 'ipv4', 'udp', 'dhcp'],
    overrides: {
      udp: { srcPort: m(67), dstPort: m(68) },
      dhcp: { op: m(2), ...dhcpMessageType(5) },
    },
  },
  {
    id: 'icmp-echo-request',
    name: 'ICMP Echo Request',
    description: 'ping 送出的那一包',
    quickAccess: false,
    layerIds: ['ethernet', 'ipv4', 'icmp'],
    overrides: { icmp: { type: m(8), code: m(0) } },
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
  {
    id: 'icmp-echo-reply',
    name: 'ICMP Echo Reply',
    description: 'ping 的回覆',
    quickAccess: false,
    layerIds: ['ethernet', 'ipv4', 'icmp'],
    overrides: { icmp: { type: m(0), code: m(0) } },
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
  {
    id: 'igmp-report',
    name: 'IGMP Membership Report',
    description: '加入群播群組',
    quickAccess: true,
    layerIds: ['ethernet', 'ipv4', 'igmp'],
    overrides: {
      ipv4: { dst: m('224.0.0.22') },
      igmp: { type: m(0x16), groupAddress: m('224.0.0.22') },
    },
  },
  {
    id: 'vlan-ipv4-udp',
    name: 'VLAN / IPv4 / UDP',
    description: '帶一層 802.1Q 標籤',
    quickAccess: true,
    layerIds: ['ethernet', 'vlan', 'ipv4', 'udp'],
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
  {
    id: 'qinq-ipv4-udp',
    name: 'Q-in-Q / IPv4 / UDP',
    description: '兩層 VLAN 標籤（802.1ad）',
    quickAccess: false,
    layerIds: ['ethernet', 'vlan', 'vlan', 'ipv4', 'udp'],
    overrides: { vlan: { vid: m(100) } },
    payload: { kind: 'pattern', size: 32, pattern: 'incrementing' },
  },
]

export function findTemplate(id: string): PacketTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

/** Create a brand-new packet definition from a template. */
export function createPacketDefFromTemplate(
  template: PacketTemplate,
  defId: string,
): PacketDef {
  const layers: LayerInstance[] = template.layerIds.map((layerId, position) => {
    const spec = getLayer(layerId)
    const overrides = template.overrides?.[layerId] ?? {}
    return {
      // the position goes into the id, so Q-in-Q's two VLAN layers become vlan-1 and vlan-2 without colliding
      instanceId: `${layerId}-${position}`,
      layerId,
      fields: { ...spec.defaults(), ...overrides },
    }
  })

  return {
    id: defId,
    name: template.name,
    layers,
    payload: template.payload ?? { kind: 'bytes', data: new Uint8Array(0) },
    count: 1,
    variations: [],
  }
}
