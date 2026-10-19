import { registerLayer } from '../registry'
import { arpLayer } from './arp'
import { dhcpLayer } from './dhcp'
import { ethernetLayer } from './ethernet'
import { icmpLayer } from './icmp'
import { igmpLayer } from './igmp'
import { ipv4Layer } from './ipv4'
import { rawLayer } from './raw'
import { tcpLayer } from './tcp'
import { udpLayer } from './udp'
import { vlanLayer } from './vlan'

/**
 * Register all built-in layers.
 * Called once from the app entry point, and again after resetRegistry().
 */
export function registerBuiltinLayers(): void {
  registerLayer(ethernetLayer)
  registerLayer(vlanLayer)
  registerLayer(ipv4Layer)
  registerLayer(tcpLayer)
  registerLayer(udpLayer)
  registerLayer(icmpLayer)
  registerLayer(igmpLayer)
  registerLayer(arpLayer)
  registerLayer(dhcpLayer)
  registerLayer(rawLayer)
}

export {
  arpLayer, dhcpLayer, ethernetLayer, icmpLayer, igmpLayer, ipv4Layer, rawLayer, tcpLayer,
  udpLayer, vlanLayer,
}
