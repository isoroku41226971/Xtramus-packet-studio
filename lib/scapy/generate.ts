import type { DecodedPacket } from '../packet/decode'
import { layerToScapy } from './layer-map'

export interface ScapyOptions {
  projectName: string
  intervalMs: number
  loopCount: number
}

/** Callers pass the decode result and the raw bytes; the TCP options fallback needs the latter. */
export interface ScapyPacket {
  decoded: DecodedPacket
  bytes: Uint8Array
}

/**
 * Layers that `from scapy.all import *` does not bring in and that need an explicit import.
 *
 * Tested with Scapy 2.7.0: Ether / Dot1Q / IP / TCP / UDP / ICMP / ARP / BOOTP /
 * DHCP / Raw / IPOption are all available; **only IGMP is not**.
 *
 * Why: scapy/layers/all.py calls load_layer() layer by layer, and a failed load
 * only logs a warning without stopping. So "the name is in conf.load_layers" does
 * **not** mean it is available after `import *`; a missing layer is silent and
 * only shows up when the script actually runs.
 *
 * IGMP has a second problem: **its module moves between versions**. 2.7.0 has it
 * in scapy.contrib.igmp; it later moved to scapy.layers.igmp (the contrib copy
 * remains but is deprecated). Generated scripts run on other people's machines
 * with versions we don't control, so both locations are tried: the new one first,
 * to avoid deprecation warnings on newer versions, then contrib as a fallback.
 */
const EXTRA_IMPORTS: Record<string, string> = {
  igmp: [
    'try:',
    '    from scapy.layers.igmp import IGMP',
    'except ImportError:  # Scapy 2.7.0 以前在 contrib',
    '    from scapy.contrib.igmp import IGMP',
  ].join('\n'),
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** One packet -> one line of `Ether(...) / IP(...) / ...`. */
function packetExpression(packet: ScapyPacket): string {
  const parts: string[] = []
  for (const layer of packet.decoded.layers) {
    parts.push(...layerToScapy(layer, packet.bytes))
  }
  if (packet.decoded.payload.length > 0) {
    parts.push(`Raw(load=bytes.fromhex("${toHexString(packet.decoded.payload)}"))`)
  }
  return parts.join(' / ')
}

/**
 * Generate a runnable Scapy script.
 *
 * packets is **one loop** of packets, not the whole sequence; the loop count goes
 * to sendp's count. Every field is written out (including automatic ones like
 * chksum and len) so Scapy does not recompute them, which is what lets
 * deliberately malformed packets actually be sent.
 */
export function generateScapyScript(packets: ScapyPacket[], options: ScapyOptions): string {
  // add the import only when the layer is actually used; an unused line in every script is noise
  const extras = new Set<string>()
  for (const packet of packets) {
    for (const layer of packet.decoded.layers) {
      const line = EXTRA_IMPORTS[layer.layerId]
      if (line) {
        extras.add(line)
      }
    }
  }
  const imports = ['from scapy.all import *', ...extras].join('\n')

  const body =
    packets.length === 0
      ? 'packets = []'
      : [
          'packets = [',
          ...packets.map((p, i) => `    # ${i + 1}\n    ${packetExpression(p)},`),
          ']',
        ].join('\n')

  return `#!/usr/bin/env python3
"""由 Packet Studio 產生 — 專案「${options.projectName}」

這支腳本會**真的把封包送到網路上**，需要提高權限。
執行前先確認下面的 IFACE 是你要的那張網卡。

    pip install scapy

    Linux / macOS：sudo python3 這支腳本.py
    Windows：      以系統管理員身分開啟終端機，再執行 python 這支腳本.py
                   Windows 還要先裝 Npcap（https://npcap.com/），
                   否則 sendp 送不出 L2 封包

只想產生 pcap 檔、不要真的送封包的話，把最後那行 sendp(...) 換成

    wrpcap("out.pcap", packets)

那只是寫一個檔案，**不需要任何特殊權限**。想確認這支腳本跟 Packet Studio
匯出的 pcap 是否一致，也是用這個方法：兩個檔案一起丟進 Wireshark 比對。
"""

${imports}

# 送出用的網卡。None = 用 Scapy 的預設；
# 不確定名稱可以先跑 show_interfaces()
IFACE = None

# 一輪要送的封包。所有自動欄位（長度、checksum）都明寫，
# Scapy 不會重算——在 Packet Studio 裡刻意寫錯的值會原樣送出去
${body}

if __name__ == "__main__":
    # inter：每送完一個封包等幾秒　count：整份清單送幾次
    sendp(packets, iface=IFACE, inter=${options.intervalMs / 1000}, count=${options.loopCount})
`
}
