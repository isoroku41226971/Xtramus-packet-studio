'use client'

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import {
  clearPendingProject,
  readPendingHandle,
  readPendingProject,
} from '@/components/pending-project'
import type { ProjectAction, ProjectState } from '@/lib/editor/project'
import { emptyProject, projectReducer } from '@/lib/editor/project'
import { deserializeProject } from '@/lib/editor/project-file'
import { registerBuiltinLayers } from '@/lib/packet/layers'
import { listLayers } from '@/lib/packet/registry'

// Register once when the module loads. React strict mode runs components twice, but
// module-level code runs once; checking listLayers again avoids double registration
// during hot reload (registerLayer throws on a duplicate id).
if (listLayers().length === 0) {
  registerBuiltinLayers()
}

interface ProjectContextValue {
  state: ProjectState
  /**
   * The second argument is a message to show for this action; omit it to clear the current message.
   *
   * It is wrapped in the provider rather than the page because PacketList and MainSlot use
   * this dispatch directly; wrapping it in the page would let them bypass the clearing.
   */
  dispatch: (action: ProjectAction, notice?: string | null) => void
  /** For UI display only and deliberately kept out of ProjectState: it is not project content and must not be saved. */
  notice: string | null
  /**
   * Which file on disk this project corresponds to. null = not set yet.
   *
   * Deliberately kept out of ProjectState: it is not project content (it must not be
   * saved) and it is not serializable. Same standing as notice.
   */
  fileHandle: FileSystemFileHandle | null
  setFileHandle: (handle: FileSystemFileHandle | null) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

/** Use the pending project if there is one, otherwise an empty project. */
function initialProject(): ProjectState {
  const json = readPendingProject()
  if (json === null) {
    return emptyProject()
  }
  try {
    return deserializeProject(json)
  } catch {
    // The home page already validated it, so reaching this point means the handoff storage
    // was tampered with. An empty project is better than breaking the page
    return emptyProject()
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(projectReducer, undefined, initialProject)
  const [notice, setNotice] = useState<string | null>(null)
  // like the project content: read once at initialization, clear in an effect
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(() =>
    readPendingHandle(),
  )

  // discard after use so a reload doesn't load the old one again. Only syncs external storage; no setState
  useEffect(() => {
    clearPendingProject()
  }, [])

  function dispatch(action: ProjectAction, next: string | null = null) {
    rawDispatch(action)
    setNotice(next)
  }

  return (
    <ProjectContext.Provider value={{ state, dispatch, notice, fileHandle, setFileHandle }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext)
  if (!value) {
    throw new Error('useProject 必須在 ProjectProvider 之內使用')
  }
  return value
}
