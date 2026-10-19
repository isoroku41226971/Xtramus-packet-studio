/** Ethernet: the capture file's link type number. */
export const LINKTYPE_ETHERNET = 1

export interface CapturedPacket {
  /**
   * Microseconds since the Unix epoch.
   *
   * number rather than bigint: current epoch microseconds are about 1.7e15, far
   * below Number.MAX_SAFE_INTEGER (about 9.0e15), so precision is safe.
   */
  timestampUs: number
  /** The bytes actually stored in the file. */
  bytes: Uint8Array
  /** The original length on the wire; larger than bytes.length means the capture truncated it. */
  originalLength: number
}

export interface CaptureFile {
  linkType: number
  packets: CapturedPacket[]
  /**
   * Problems found while reading that were not serious enough to abort,
   * e.g. a truncated final record, multiple interfaces, skipped unknown blocks.
   */
  warnings: string[]
}

export type CaptureFormat = 'pcap' | 'pcapng'
