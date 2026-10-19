import { isPcap, readPcap, writePcap } from './pcap'
import { isPcapng, readPcapng, writePcapng } from './pcapng'
import type { CaptureFile, CaptureFormat } from './types'

export type { CapturedPacket, CaptureFile, CaptureFormat } from './types'
export { LINKTYPE_ETHERNET } from './types'
export { isPcap, readPcap, writePcap } from './pcap'
export { isPcapng, readPcapng, writePcapng } from './pcapng'

/** Detect the format from the start of the file; null when it is neither. */
export function detectFormat(bytes: Uint8Array): CaptureFormat | null {
  if (isPcapng(bytes)) {
    return 'pcapng'
  }
  if (isPcap(bytes)) {
    return 'pcap'
  }
  return null
}

/** Detect the format and read it. Throws if unrecognized: that is a tool failure, not flawed data. */
export function readCapture(bytes: Uint8Array): CaptureFile {
  const format = detectFormat(bytes)
  if (format === 'pcapng') {
    return readPcapng(bytes)
  }
  if (format === 'pcap') {
    return readPcap(bytes)
  }
  throw new Error('無法辨識的檔案格式：支援的是 pcap 與 pcapng')
}

export function writeCapture(file: CaptureFile, format: CaptureFormat): Uint8Array {
  if (format === 'pcap') {
    return writePcap(file)
  }
  if (format === 'pcapng') {
    return writePcapng(file)
  }
  throw new Error(`未知的擷取檔格式：${format}`)
}
