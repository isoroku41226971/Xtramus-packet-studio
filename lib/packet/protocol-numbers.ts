/**
 * The single source of protocol numbers.
 *
 * Ethernet and VLAN both translate "which layer is inside" into an EtherType, and
 * IPv4 translates it into an IP protocol number. Keeping them here avoids each
 * layer storing its own copy.
 */

/** Inner layerId -> EtherType value. */
export const ETHERTYPE_BY_LAYER: Record<string, number> = {
  ipv4: 0x0800,
  arp: 0x0806,
  vlan: 0x8100,
  ipv6: 0x86dd,
}

/** Inner layerId -> IP protocol number. */
export const IP_PROTOCOL_BY_LAYER: Record<string, number> = {
  icmp: 1,
  igmp: 2,
  tcp: 6,
  udp: 17,
}

const LAYER_BY_ETHERTYPE: Record<number, string> = Object.fromEntries(
  Object.entries(ETHERTYPE_BY_LAYER).map(([id, type]) => [type, id]),
)

const LAYER_BY_IP_PROTOCOL: Record<number, string> = Object.fromEntries(
  Object.entries(IP_PROTOCOL_BY_LAYER).map(([id, num]) => [num, id]),
)

/** An unknown EtherType returns null; when decoding this means falling back to payload, not an error. */
export function layerIdForEtherType(etherType: number): string | null {
  return LAYER_BY_ETHERTYPE[etherType] ?? null
}

/** An unknown protocol number returns null. */
export function layerIdForIpProtocol(protocol: number): string | null {
  return LAYER_BY_IP_PROTOCOL[protocol] ?? null
}

/**
 * Inner layerId -> the UDP port that protocol uses.
 *
 * Only protocols with an implemented layer are listed. DNS (53) and NTP (123) have
 * no layer; adding them would only make nextLayerId point to an unregistered layer.
 * decodePacket would fall back to payload correctly, but that is a pointless detour.
 */
export const UDP_PORTS_BY_LAYER: Record<string, number[]> = {
  dhcp: [67, 68],
}

const LAYER_BY_UDP_PORT: Record<number, string> = Object.fromEntries(
  Object.entries(UDP_PORTS_BY_LAYER).flatMap(([id, ports]) => ports.map((p) => [p, id])),
)

/**
 * Determine the inner protocol from UDP port numbers.
 *
 * The destination port wins: DHCP requests are 68->67 and replies 67->68, so both
 * directions must be recognized, but in general the destination port says who the
 * packet is for.
 */
export function layerIdForUdpPort(srcPort: number, dstPort: number): string | null {
  return LAYER_BY_UDP_PORT[dstPort] ?? LAYER_BY_UDP_PORT[srcPort] ?? null
}
