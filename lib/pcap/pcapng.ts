import { ByteWriter } from './bytes'
import type { CapturedPacket, CaptureFile } from './types'

const BLOCK_SECTION_HEADER = 0x0a0d0d0a
const BLOCK_INTERFACE_DESCRIPTION = 0x00000001
const BLOCK_ENHANCED_PACKET = 0x00000006

const BYTE_ORDER_MAGIC = 0x1a2b3c4d
const VERSION_MAJOR = 1
const VERSION_MINOR = 0
const DEFAULT_SNAPLEN = 65535

const SHB_LENGTH = 28
const IDB_LENGTH = 20
/** The fixed part of an EPB: type, length x2, interface, timestamp x2, lengths x2. */
const EPB_OVERHEAD = 32

/**
 * Write a pcapng file (little-endian, single interface).
 *
 * The if_tsresol option is omitted: without it the default resolution is
 * microseconds, which matches CapturedPacket.timestampUs exactly.
 */
export function writePcapng(file: CaptureFile): Uint8Array {
  const w = new ByteWriter()

  // Section Header Block
  w.u32(BLOCK_SECTION_HEADER)
    .u32(SHB_LENGTH)
    .u32(BYTE_ORDER_MAGIC)
    .u16(VERSION_MAJOR)
    .u16(VERSION_MINOR)
    .u32(0xffffffff) // section length = -1 (unknown)
    .u32(0xffffffff)
    .u32(SHB_LENGTH)

  // Interface Description Block
  w.u32(BLOCK_INTERFACE_DESCRIPTION)
    .u32(IDB_LENGTH)
    .u16(file.linkType)
    .u16(0) // reserved
    .u32(DEFAULT_SNAPLEN)
    .u32(IDB_LENGTH)

  // one Enhanced Packet Block per packet
  for (const packet of file.packets) {
    const paddedLength = Math.ceil(packet.bytes.length / 4) * 4
    const totalLength = EPB_OVERHEAD + paddedLength

    w.u32(BLOCK_ENHANCED_PACKET)
      .u32(totalLength)
      .u32(0) // interface ID
      // 時間戳是高位在前，與 ByteWriter.u64（低位在前）相反，因此分開寫
      .u32(Math.floor(packet.timestampUs / 2 ** 32))
      .u32(packet.timestampUs >>> 0)
      .u32(packet.bytes.length)
      .u32(packet.originalLength)
      .bytes(packet.bytes)
      .padTo4()
      .u32(totalLength)
  }

  return w.toUint8Array()
}

const BYTE_ORDER_MAGIC_SWAPPED = 0x4d3c2b1a
const OPTION_IF_TSRESOL = 9
const OPTION_END = 0
/** Block type + total length + trailing total length. */
const BLOCK_OVERHEAD = 12

/** Whether this data looks like pcapng. Checks only the leading block type. */
export function isPcapng(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false
  }
  return bytes[0] === 0x0a && bytes[1] === 0x0d && bytes[2] === 0x0d && bytes[3] === 0x0a
}

/** Convert an if_tsresol value into microseconds per unit. */
function tsresolToMicroseconds(raw: number): number {
  if ((raw & 0x80) !== 0) {
    // top bit set: the resolution is 2^-(raw & 0x7f) seconds
    return 1_000_000 / 2 ** (raw & 0x7f)
  }
  // top bit clear: the resolution is 10^-raw seconds
  return 1_000_000 / 10 ** raw
}

/** Look for if_tsresol in the IDB options; defaults to microseconds if absent. */
function readTsresol(
  view: DataView,
  start: number,
  end: number,
  littleEndian: boolean,
): number {
  let offset = start
  while (offset + 4 <= end) {
    const code = view.getUint16(offset, littleEndian)
    const length = view.getUint16(offset + 2, littleEndian)
    if (code === OPTION_END) {
      break
    }
    if (code === OPTION_IF_TSRESOL && length >= 1 && offset + 4 < end) {
      return tsresolToMicroseconds(view.getUint8(offset + 4))
    }
    // option values are padded to a multiple of 4
    offset += 4 + Math.ceil(length / 4) * 4
  }
  return 1 // default 10^-6 s = 1 microsecond
}

/**
 * Read a pcapng file.
 *
 * Only a single interface is supported; a second IDB logs a warning and the first
 * one's settings are kept. Unknown block types are skipped by their total length.
 * Incomplete data stops reading with a warning, keeping every packet already read.
 */
export function readPcapng(bytes: Uint8Array): CaptureFile {
  if (!isPcapng(bytes)) {
    throw new Error('不是 pcapng 檔案：開頭不是 Section Header Block')
  }
  if (bytes.length < SHB_LENGTH) {
    throw new Error(`pcapng 的 Section Header Block 需要 ${SHB_LENGTH} bytes，只有 ${bytes.length}`)
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // the byte order comes from the SHB's Byte-Order Magic
  let littleEndian = true
  const magicAsLe = view.getUint32(8, true)
  if (magicAsLe === BYTE_ORDER_MAGIC) {
    littleEndian = true
  } else if (magicAsLe === BYTE_ORDER_MAGIC_SWAPPED) {
    littleEndian = false
  } else {
    throw new Error('pcapng 的 Byte-Order Magic 不符')
  }

  const packets: CapturedPacket[] = []
  const warnings: string[] = []
  let linkType = 0
  let usPerTick = 1
  let seenInterface = false
  let seenSection = false
  let offset = 0

  while (offset < bytes.length) {
    if (bytes.length - offset < 8) {
      warnings.push(`尾端剩下 ${bytes.length - offset} bytes，不足一個區塊標頭，已停止讀取`)
      break
    }
    const blockType = view.getUint32(offset, littleEndian)
    const blockLength = view.getUint32(offset + 4, littleEndian)

    if (blockLength < BLOCK_OVERHEAD || offset + blockLength > bytes.length) {
      warnings.push(
        `位於 ${offset} 的區塊宣告長度 ${blockLength}，不合理或超出剩餘資料，已停止讀取`,
      )
      break
    }

    if (blockType === BLOCK_SECTION_HEADER) {
      if (seenSection) {
        warnings.push(`位於 ${offset} 的第二個 Section Header Block 已忽略，沿用第一個的設定`)
      }
      seenSection = true
    } else if (blockType === BLOCK_INTERFACE_DESCRIPTION) {
      if (seenInterface) {
        warnings.push(`位於 ${offset} 的第二個 Interface Description Block 已忽略，只支援單一介面`)
      } else {
        linkType = view.getUint16(offset + 8, littleEndian)
        usPerTick = readTsresol(view, offset + 16, offset + blockLength - 4, littleEndian)
        seenInterface = true
      }
    } else if (blockType === BLOCK_ENHANCED_PACKET) {
      const tsHigh = view.getUint32(offset + 12, littleEndian)
      const tsLow = view.getUint32(offset + 16, littleEndian)
      const capturedLength = view.getUint32(offset + 20, littleEndian)
      const originalLength = view.getUint32(offset + 24, littleEndian)
      const dataStart = offset + 28

      if (dataStart + capturedLength > offset + blockLength) {
        warnings.push(`位於 ${offset} 的封包區塊宣告的資料長度超出區塊範圍，已停止讀取`)
        break
      }
      packets.push({
        timestampUs: (tsHigh * 2 ** 32 + tsLow) * usPerTick,
        // take only the declared length, not the padding zeros
        bytes: bytes.slice(dataStart, dataStart + capturedLength),
        originalLength,
      })
    } else {
      warnings.push(`位於 ${offset} 的區塊型別 0x${blockType.toString(16)} 未支援，已跳過`)
    }

    offset += blockLength
  }

  return { linkType, packets, warnings }
}

export {
  BLOCK_SECTION_HEADER,
  BLOCK_INTERFACE_DESCRIPTION,
  BLOCK_ENHANCED_PACKET,
  BYTE_ORDER_MAGIC,
  EPB_OVERHEAD,
}
