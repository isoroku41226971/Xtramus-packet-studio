/**
 * One-time handoff of a project to load, from the home page to the workspace.
 *
 * The home page has no ProjectProvider (it lives in /studio), so a loaded project
 * has to be passed to the next page somehow. sessionStorage is used instead of:
 *   - lifting ProjectProvider into the root layout, which would change a stable
 *     architecture, and the home page needs no project state anyway
 *   - a module-level variable, which disappears on a full page reload
 *
 * This file touches browser APIs, so it lives in components/ rather than lib/,
 * following components/viewer/download.ts.
 */
const KEY = 'packet-studio:pending-project'

/**
 * The file handle for the pending project.
 *
 * A module-level variable rather than sessionStorage: a FileSystemFileHandle is not
 * JSON and cannot be stored there. / -> /studio has been verified to be client-side
 * navigation, not a full reload, so JavaScript state survives.
 */
let pendingHandle: FileSystemFileHandle | null = null

/** Throws when it cannot be stored (e.g. quota exceeded); the caller shows the message. */
export function stashPendingProject(
  json: string,
  handle: FileSystemFileHandle | null = null,
): void {
  sessionStorage.setItem(KEY, json)
  pendingHandle = handle
}

/**
 * Read the pending project; null if there is none.
 *
 * **Reads without clearing**, so repeated calls give the same result: React strict
 * mode runs useReducer's initializer twice, and clearing on read would make the
 * second call get null. During server-side rendering there is no sessionStorage, so
 * it returns null; without this check the whole page would fail on the server, not
 * just loading.
 */
export function readPendingProject(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return sessionStorage.getItem(KEY)
}

/**
 * Read the pending project's file handle; null if there is none.
 *
 * Like readPendingProject it **reads without clearing**: React strict mode runs
 * useReducer / useState initializers twice, and clearing on read would make the
 * second call get null.
 */
export function readPendingHandle(): FileSystemFileHandle | null {
  return pendingHandle
}

/** Discard after use. Clearing twice is harmless. */
export function clearPendingProject(): void {
  // the module variable needs no window, so it goes before the SSR check below
  pendingHandle = null
  if (typeof window === 'undefined') {
    return
  }
  sessionStorage.removeItem(KEY)
}
