import type { CaptureFile, CapturedPacket } from '../pcap'
import { LINKTYPE_ETHERNET } from '../pcap'
import type { EmulatedSequence } from './sequence'

/**
 * Expand a lazy sequence into a capture ready for the pcap writer.
 *
 * baseTimestampUs is passed in by the caller instead of calling Date.now() here,
 * which would make this impure and impossible to assert on. The UI passes
 * Date.now() * 1000; callers that need deterministic output pass a fixed value.
 *
 * The whole sequence is expanded in memory. Streaming output was the original
 * plan, but writeCapture takes a fully expanded array, and real sequences here
 * hold a few thousand packets (10,000 x 74 bytes is under 1 MB), so the cost is
 * accepted. Laziness still pays off in the viewer, which decodes only the few
 * dozen visible rows.
 */
export function sequenceToCaptureFile(
  sequence: EmulatedSequence,
  baseTimestampUs: number,
): CaptureFile {
  const packets: CapturedPacket[] = []

  for (let i = 0; i < sequence.length; i++) {
    const p = sequence.at(i)
    packets.push({
      timestampUs: baseTimestampUs + p.timeUs,
      bytes: p.bytes,
      // packets we generate are never truncated, so the wire length is the actual length
      originalLength: p.bytes.length,
    })
  }

  return { linkType: LINKTYPE_ETHERNET, packets, warnings: [] }
}
