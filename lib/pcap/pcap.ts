import { ByteWriter } from './bytes'
import type { CapturedPacket, CaptureFile } from './types'

/** The magic number; written little-endian its bytes are d4 c3 b2 a1. */
const MAGIC_MICROSECONDS = 0xa1b2c3d4
const VERSION_MAJOR = 2
const VERSION_MINOR = 4
const DEFAULT_SNAPLEN = 65535
const GLOBAL_HEADER_LENGTH = 24
const RECORD_HEADER_LENGTH = 16

/**
 * Write a classic pcap file (little-endian, microsecond precision).
 *
 * Format: a 24-byte global header, then for each packet a 16-byte record header
 * plus the raw data, with no alignment padding between records.
 */
export function writePcap(file: CaptureFile): Uint8Array {
  const w = new ByteWriter()

  w.u32(MAGIC_MICROSECONDS)
    .u16(VERSION_MAJOR)
    .u16(VERSION_MINOR)
    .u32(0) // time zone offset, always 0 in practice
    .u32(0) // timestamp accuracy, always 0 in practice
    .u32(DEFAULT_SNAPLEN)
    .u32(file.linkType)

  for (const packet of file.packets) {
    const seconds = Math.floor(packet.timestampUs / 1_000_000)
    const microseconds = packet.timestampUs % 1_000_000
    w.u32(seconds)
      .u32(microseconds)
      .u32(packet.bytes.length)
      .u32(packet.originalLength)
      .bytes(packet.bytes)
  }

  return w.toUint8Array()
}

/** The leading bytes of the four magic numbers, with the byte order and time unit each implies. */
const MAGICS: Array<{ bytes: number[]; littleEndian: boolean; nanoseconds: boolean }> = [
  { bytes: [0xa1, 0xb2, 0xc3, 0xd4], littleEndian: false, nanoseconds: false },
  { bytes: [0xd4, 0xc3, 0xb2, 0xa1], littleEndian: true, nanoseconds: false },
  { bytes: [0xa1, 0xb2, 0x3c, 0x4d], littleEndian: false, nanoseconds: true },
  { bytes: [0x4d, 0x3c, 0xb2, 0xa1], littleEndian: true, nanoseconds: true },
]

function matchMagic(bytes: Uint8Array) {
  if (bytes.length < 4) {
    return undefined
  }
  return MAGICS.find((m) => m.bytes.every((b, i) => bytes[i] === b))
}

/** Whether this data looks like classic pcap. Checks only the first 4 bytes, nothing else. */
export function isPcap(bytes: Uint8Array): boolean {
  return matchMagic(bytes) !== undefined
}

/**
 * Read a classic pcap file.
 *
 * All four magic numbers are supported (big/little-endian x microseconds/nanoseconds).
 * Incomplete data stops reading with a warning, keeping every packet already read:
 * real captures are often truncated at the end, and that must not make the whole
 * file unreadable.
 */
export function readPcap(bytes: Uint8Array): CaptureFile {
  const magic = matchMagic(bytes)
  if (!magic) {
    throw new Error('不是 pcap 檔案：開頭的魔術數字不符')
  }
  if (bytes.length < GLOBAL_HEADER_LENGTH) {
    throw new Error(
      `pcap 全域標頭需要 ${GLOBAL_HEADER_LENGTH} bytes，只有 ${bytes.length}`,
    )
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const le = magic.littleEndian
  const linkType = view.getUint32(20, le)

  const packets: CapturedPacket[] = []
  const warnings: string[] = []
  let offset = GLOBAL_HEADER_LENGTH

  while (offset < bytes.length) {
    if (bytes.length - offset < RECORD_HEADER_LENGTH) {
      warnings.push(
        `第 ${packets.length + 1} 筆記錄的標頭不完整（剩 ${bytes.length - offset} bytes），已停止讀取`,
      )
      break
    }
    const tsSec = view.getUint32(offset, le)
    const tsFrac = view.getUint32(offset + 4, le)
    const inclLen = view.getUint32(offset + 8, le)
    const origLen = view.getUint32(offset + 12, le)
    const dataStart = offset + RECORD_HEADER_LENGTH

    if (dataStart + inclLen > bytes.length) {
      warnings.push(
        `第 ${packets.length + 1} 筆記錄宣告 ${inclLen} bytes，超出剩餘資料，已停止讀取`,
      )
      break
    }

    packets.push({
      timestampUs: tsSec * 1_000_000 + (magic.nanoseconds ? Math.floor(tsFrac / 1000) : tsFrac),
      bytes: bytes.slice(dataStart, dataStart + inclLen),
      originalLength: origLen,
    })
    offset = dataStart + inclLen
  }

  return { linkType, packets, warnings }
}

export { GLOBAL_HEADER_LENGTH, RECORD_HEADER_LENGTH, MAGIC_MICROSECONDS }
