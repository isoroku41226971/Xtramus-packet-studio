/**
 * Type additions for the File System Access API.
 *
 * TypeScript 5.9's lib.dom.d.ts has FileSystemFileHandle itself (name / getFile /
 * createWritable) but not these three:
 *   - window.showSaveFilePicker
 *   - window.showOpenFilePicker
 *   - handle.queryPermission / requestPermission (Chromium's permission extension)
 *
 * With no import / export this is a global declaration file, so the interfaces merge with lib.dom.
 */

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string | string[]>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: FilePickerAcceptType[]
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface DataTransferItem {
  /**
   * Used to get a writable handle on drop; Chromium only.
   * It may return a folder handle, so callers must check kind.
   */
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>
}
