/**
 * The single gateway to the File System Access API.
 *
 * Only Chromium browsers (Chrome / Edge) have this API; Firefox and Safari do not.
 * All other code asks canUseFileSystemAccess() first and never touches
 * window.showSaveFilePicker directly.
 *
 * Code that touches browser APIs lives in components/ rather than lib/, following
 * components/viewer/download.ts.
 */

const PSPROJ_TYPES = [
  {
    description: 'Packet Studio 專案',
    accept: { 'application/json': ['.psproj'] },
  },
]

export function canUseFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

/** The file was deleted or moved, so the handle should be discarded. */
export function isFileMissing(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotFoundError'
}

/**
 * Run a file picker; returns null when the user cancels.
 *
 * Cancelling throws AbortError, which is **not an error**. Treating cancel as a failed
 * save and showing a red message is the easiest mistake to make here, so it becomes
 * null right here and the types force callers to handle it separately.
 */
async function pick(
  run: () => Promise<FileSystemFileHandle>,
): Promise<FileSystemFileHandle | null> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return null
    }
    throw e
  }
}

async function write(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(text)
    // without close the content never reaches the disk; close is the commit step
    await writable.close()
  } catch (e) {
    // Abort if writing fails halfway, so no half-written file is left behind.
    // If abort itself fails it doesn't matter; the original error is what gets rethrown
    await writable.abort().catch(() => {})
    throw e
  }
}

/** Only picks a file and reads its text, **without validating it**; parsing .psproj is up to the caller. */
export async function openProjectFile(): Promise<{
  handle: FileSystemFileHandle
  text: string
} | null> {
  const handle = await pick(
    async () => (await window.showOpenFilePicker({ multiple: false, types: PSPROJ_TYPES }))[0],
  )
  if (handle === null) {
    return null
  }
  return { handle, text: await (await handle.getFile()).text() }
}

/**
 * Only picks a location, **without writing**.
 *
 * Kept separate from writing on purpose: the user may rename the file in the system
 * dialog, and the name inside the project must match the final file name. Get the
 * handle, read handle.name, build the content with that name, and only then call
 * writeProjectFile. Doing it in one step could only serialize the intended name, so
 * the saved content would carry the old name.
 */
export async function pickSaveLocation(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  return pick(() => window.showSaveFilePicker({ suggestedName, types: PSPROJ_TYPES }))
}

export async function writeProjectFile(handle: FileSystemFileHandle, text: string): Promise<void> {
  // A handle from showOpenFilePicker is read-only, so ask before writing.
  // A button click counts as a user gesture, which the permission prompt requires
  if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new Error('沒有寫入這個檔案的權限')
    }
  }
  await write(handle, text)
}

export interface DroppedFile {
  file: File
  /** Set only when a writable handle is available; null in unsupported browsers or when a folder is dropped. */
  handle: FileSystemFileHandle | null
}

/**
 * Get the files from a drop event and try to obtain writable handles too.
 *
 * getAsFileSystemHandle() must be called **synchronously** in the event handler,
 * because DataTransferItems become invalid when the event ends. So all promises are
 * collected synchronously and awaited together afterwards, never awaited in the loop.
 */
export function readDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const pending: Array<Promise<DroppedFile>> = []

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file') {
      continue
    }
    const file = item.getAsFile()
    if (file === null) {
      continue
    }
    const asHandle =
      typeof item.getAsFileSystemHandle === 'function'
        ? item.getAsFileSystemHandle()
        : Promise.resolve(null)
    pending.push(
      asHandle
        // 用真值判斷而不是 !== null：合成的 DataTransfer（測試裡用 new File() 組的）
        // resolve 出來的是 undefined 而不是 null，只擋 null 會讓下一行的 .kind 丟錯。
        // kind 檢查則是順便擋掉拖進來的資料夾
        .then((handle) => ({
          file,
          handle: handle && handle.kind === 'file' ? (handle as FileSystemFileHandle) : null,
        }))
        // 拿不到握柄不是失敗，退回只有 File 就好
        .catch(() => ({ file, handle: null })),
    )
  }

  return Promise.all(pending)
}
