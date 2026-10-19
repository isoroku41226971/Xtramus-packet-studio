// The single source of MainSlotItem and StyleConfig is editor/project, where the
// state the user actually edits lives. Both are import type, erased at compile
// time, so there is no runtime coupling.
import type { MainSlotItem, StyleConfig } from '../editor/project'
import type { PacketDef } from './packet-def'
import { buildPacketDefAt } from './packet-def'

export interface EmulatedPacket {
  index: number
  /** Relative time from 0. The absolute base is decided by the export layer. */
  timeUs: number
  bytes: Uint8Array
  /** Which packet definition this traces back to. */
  sourceDefId: string
}

export interface EmulatedSequence {
  /** Total packet count. Pure arithmetic; no packets are expanded. */
  readonly length: number
  /** Packet number index. Pure: the same index always gives the same result. */
  at(index: number): EmulatedPacket
}

/**
 * Combine the selection and the playback settings into a lazy sequence.
 *
 * Lazy means length is pure arithmetic and at(i) builds only that one packet.
 * Even with a million packets in total, memory never holds more than one at a time.
 */
export function createSequence(
  main: MainSlotItem[],
  defs: Map<string, PacketDef>,
  style: StyleConfig,
): EmulatedSequence {
  /** How many packets each entry takes in one loop. */
  function spans(): number[] {
    return main.map((item) => {
      const def = defs.get(item.packetDefId)
      if (!def) {
        throw new Error(`主選槽指向不存在的封包定義：${item.packetDefId}`)
      }
      return item.repeat * def.count
    })
  }

  return {
    get length(): number {
      const perLoop = spans().reduce((sum, n) => sum + n, 0)
      return Math.max(0, style.loopCount) * perLoop
    },

    at(index: number): EmulatedPacket {
      const itemSpans = spans()
      const perLoop = itemSpans.reduce((sum, n) => sum + n, 0)
      const total = Math.max(0, style.loopCount) * perLoop

      if (!Number.isInteger(index) || index < 0 || index >= total) {
        throw new RangeError(`索引 ${index} 超出序列範圍（共 ${total} 筆）`)
      }

      // work it out arithmetically, without walking the earlier packets
      let withinLoop = index % perLoop
      let itemIndex = 0
      while (withinLoop >= itemSpans[itemIndex]) {
        withinLoop -= itemSpans[itemIndex]
        itemIndex += 1
      }

      const item = main[itemIndex]
      const def = defs.get(item.packetDefId) as PacketDef
      // every repeat starts again from packet 0
      const variationIndex = withinLoop % def.count

      return {
        index,
        timeUs: index * style.intervalMs * 1000,
        bytes: buildPacketDefAt(def, variationIndex).bytes,
        sourceDefId: def.id,
      }
    },
  }
}
