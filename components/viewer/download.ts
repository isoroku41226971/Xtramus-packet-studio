/**
 * Trigger a browser download.
 *
 * This is the only place in the project that touches DOM APIs like Blob, URL and
 * anchors; keeping it in its own file lets the React components stay purely declarative.
 */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/vnd.tcpdump.pcap',
): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Defer the release to the next tick: a synchronous revoke could free the blob before the
  // browser has queued the download. Not releasing it isn't an option either, since the blob
  // would live until the tab closes.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Turn the name the user typed into a valid file name.
 *
 * The extension is not added again if it is already correct: with the export dialog
 * letting users type the file name, typing test1.pcap and choosing pcap would
 * otherwise give test1.pcap.pcap, which really happens.
 */
export function safeFilename(name: string, extension: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, '_').trim()
  const suffix = `.${extension}`

  if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
    // if nothing is left after removing the extension (e.g. just ".pcap"), a base name is still needed
    const stem = cleaned.slice(0, -suffix.length)
    return stem ? cleaned : `未命名專案${suffix}`
  }

  return `${cleaned || '未命名專案'}${suffix}`
}

/**
 * The inverse of safeFilename: turn a file name back into a project name.
 *
 * The extension match is case-insensitive because the system save dialog may return
 * .PSPROJ. If nothing is left after removing the extension (e.g. a file named just
 * ".psproj"), it falls back to the default name, mirroring safeFilename.
 */
export function projectNameFromFilename(filename: string, extension = 'psproj'): string {
  const suffix = `.${extension}`
  const stem = filename.toLowerCase().endsWith(suffix.toLowerCase())
    ? filename.slice(0, -suffix.length)
    : filename
  return stem || '未命名專案'
}
