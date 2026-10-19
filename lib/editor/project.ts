import type { PacketDef } from '../emulator/packet-def'

export interface MainSlotItem {
  /** The selection list entry's own id, independent of packetDefId, so one definition can appear several times. */
  itemId: string
  packetDefId: string
  /** ×N: how many times this entry repeats as a group. Minimum 1. */
  repeat: number
}

export interface StyleConfig {
  intervalMs: number
  /** 1 = no looping. */
  loopCount: number
}

export interface ProjectState {
  name: string
  packetDefs: PacketDef[]
  /** The selection list, in order. An empty array means nothing to send. */
  main: MainSlotItem[]
  style: StyleConfig
}

export type ProjectAction =
  | { type: 'rename-project'; name: string }
  | { type: 'add-packet'; def: PacketDef }
  | { type: 'update-packet'; def: PacketDef }
  | { type: 'remove-packet'; id: string }
  /** 新 id 由呼叫端產生，reducer 才能維持純函數。 */
  | { type: 'duplicate-packet'; id: string; newId: string }
  | { type: 'reorder-packet'; id: string; toIndex: number }
  /** itemId 同樣由呼叫端產生。 */
  | { type: 'add-to-main'; packetDefId: string; itemId: string }
  | { type: 'remove-from-main'; itemId: string }
  /** 一次清空主選欄。封包定義不動。 */
  | { type: 'clear-main' }
  | { type: 'reorder-main'; itemId: string; toIndex: number }
  | { type: 'set-repeat'; itemId: string; repeat: number }
  | { type: 'set-style'; style: Partial<StyleConfig> }

export function emptyProject(name = '未命名專案'): ProjectState {
  return { name, packetDefs: [], main: [], style: { intervalMs: 100, loopCount: 1 } }
}

/** Find the position of an id; throws if missing, since that is a programming error that must not be skipped silently. */
function indexOf(state: ProjectState, id: string): number {
  const index = state.packetDefs.findIndex((d) => d.id === id)
  if (index === -1) {
    throw new Error(`專案裡沒有這個封包定義：${id}`)
  }
  return index
}

/** Find the position of a selection list entry; throws if missing, for the same reason as indexOf. */
function mainIndexOf(state: ProjectState, itemId: string): number {
  const index = state.main.findIndex((i) => i.itemId === itemId)
  if (index === -1) {
    throw new Error(`主選欄裡沒有這個項目：${itemId}`)
  }
  return index
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'rename-project':
      return { ...state, name: action.name }

    case 'add-packet':
      return { ...state, packetDefs: [...state.packetDefs, action.def] }

    case 'update-packet': {
      const index = indexOf(state, action.def.id)
      const packetDefs = [...state.packetDefs]
      packetDefs[index] = action.def
      return { ...state, packetDefs }
    }

    case 'remove-packet': {
      const index = indexOf(state, action.id)
      const packetDefs = [...state.packetDefs]
      packetDefs.splice(index, 1)
      // Also remove selection list entries that reference this definition. Left behind they
      // would dangle, and expanding the sequence would not find the definition; the same
      // reasoning as stack-edit.removeLayerAt removing orphaned variation rules.
      const main = state.main.filter((i) => i.packetDefId !== action.id)
      return { ...state, packetDefs, main }
    }

    case 'duplicate-packet': {
      const index = indexOf(state, action.id)
      const original = state.packetDefs[index]
      const copy: PacketDef = {
        ...original,
        id: action.newId,
        name: `${original.name} 複本`,
      }
      const packetDefs = [...state.packetDefs]
      packetDefs.splice(index + 1, 0, copy)
      return { ...state, packetDefs }
    }

    case 'reorder-packet': {
      const from = indexOf(state, action.id)
      const packetDefs = [...state.packetDefs]
      const [moved] = packetDefs.splice(from, 1)
      const to = Math.max(0, Math.min(action.toIndex, packetDefs.length))
      packetDefs.splice(to, 0, moved)
      return { ...state, packetDefs }
    }

    case 'add-to-main': {
      // check that the definition exists first, or this would create an entry that dangles immediately
      indexOf(state, action.packetDefId)
      const item: MainSlotItem = {
        itemId: action.itemId,
        packetDefId: action.packetDefId,
        repeat: 1,
      }
      return { ...state, main: [...state.main, item] }
    }

    case 'remove-from-main': {
      const index = mainIndexOf(state, action.itemId)
      const main = [...state.main]
      main.splice(index, 1)
      return { ...state, main }
    }

    case 'clear-main':
      return { ...state, main: [] }

    case 'reorder-main': {
      const from = mainIndexOf(state, action.itemId)
      const main = [...state.main]
      const [moved] = main.splice(from, 1)
      const to = Math.max(0, Math.min(action.toIndex, main.length))
      main.splice(to, 0, moved)
      return { ...state, main }
    }

    case 'set-repeat': {
      const index = mainIndexOf(state, action.itemId)
      const main = [...state.main]
      main[index] = { ...main[index], repeat: Math.max(1, Math.floor(action.repeat)) }
      return { ...state, main }
    }

    case 'set-style':
      return { ...state, style: { ...state.style, ...action.style } }
  }
}
