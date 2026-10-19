import type { PacketDef } from '../emulator/packet-def'
import { decodePacket } from '../packet/decode'
import type { LayerInstance } from '../packet/model'
import type { CapturedPacket } from '../pcap'

/**
 * Turn one packet from a capture file into an editable packet definition.
 *
 * Every field is stored as manual rather than auto. With auto, lengths and
 * checksums would be recomputed on rebuild: identical for well-formed packets,
 * but deliberately malformed packets (this tool's main use) would be silently
 * "fixed", so importing and re-exporting would not give back the original file.
 *
 * id and name are supplied by the caller, keeping this a pure function.
 */
export function capturedToPacketDef(
  captured: CapturedPacket,
  id: string,
  name: string,
): PacketDef {
  const decoded = decodePacket(captured.bytes)

  const layers: LayerInstance[] = decoded.layers.map((l, i) => ({
    instanceId: `${l.layerId}-${i}`,
    layerId: l.layerId,
    fields: Object.fromEntries(
      Object.entries(l.values).map(([key, value]) => [key, { mode: 'manual' as const, value }]),
    ),
  }))

  return {
    id,
    name,
    layers,
    payload: { kind: 'bytes', data: decoded.payload },
    count: 1,
    variations: [],
    // when nothing can be decoded, buildPacketDefAt outputs these bytes unchanged
    raw: captured.bytes,
  }
}
