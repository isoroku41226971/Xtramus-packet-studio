import type { ProjectState } from './project'

/**
 * How many bytes to convert at a time.
 *
 * String.fromCharCode(...bytes) spreads every byte into a function argument and
 * throws RangeError for large arrays. Imported raw packets can be large, so the
 * conversion is chunked.
 */
const CHUNK_SIZE = 0x8000

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export const PROJECT_FILE_VERSION = 1

/** How binary data looks in JSON. */
interface BytesEnvelope {
  __bytes: string
}

function isBytesEnvelope(value: unknown): value is BytesEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BytesEnvelope).__bytes === 'string'
  )
}

/**
 * Walk the whole object tree and replace every Uint8Array with a base64 envelope.
 *
 * Not listing the known fields is deliberate: binary data lives in four places,
 * one of them nested in objects inside the DHCP options array, and a hand-written
 * per-field conversion would miss something. By default JSON.stringify turns a
 * Uint8Array into an object like {"0":1,"1":2}, which parses back as something
 * other than a Uint8Array **with no error**, only discovered when a packet is built.
 */
function replacer(key: string, value: unknown): unknown {
  return value instanceof Uint8Array ? { __bytes: bytesToBase64(value) } : value
}

/** The inverse of the replacer. JSON.parse calls the reviver inside-out, so nested values are restored first. */
function reviver(key: string, value: unknown): unknown {
  return isBytesEnvelope(value) ? base64ToBytes(value.__bytes) : value
}

export function serializeProject(state: ProjectState): string {
  return JSON.stringify({ version: PROJECT_FILE_VERSION, state }, replacer)
}

export function deserializeProject(json: string): ProjectState {
  let parsed: unknown
  try {
    parsed = JSON.parse(json, reviver)
  } catch (e) {
    throw new Error(`這不是合法的專案檔：${e instanceof Error ? e.message : String(e)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('這不是合法的專案檔：內容不是物件')
  }

  const file = parsed as { version?: unknown; state?: unknown }
  if (file.version !== PROJECT_FILE_VERSION) {
    throw new Error(
      `不認得的專案檔版本：${String(file.version)}（這個版本只讀得懂 ${PROJECT_FILE_VERSION}）`,
    )
  }

  const state = file.state
  if (typeof state !== 'object' || state === null) {
    throw new Error('專案檔缺少必要欄位：state')
  }

  // Only the shape of the four top-level fields is checked. Validating every level
  // below would mean rewriting the whole type system, and these files are written
  // by this program itself
  const s = state as Partial<ProjectState>
  if (
    typeof s.name !== 'string' ||
    !Array.isArray(s.packetDefs) ||
    !Array.isArray(s.main) ||
    typeof s.style !== 'object' ||
    s.style === null
  ) {
    throw new Error('專案檔缺少必要欄位：name / packetDefs / main / style')
  }

  return state as ProjectState
}
