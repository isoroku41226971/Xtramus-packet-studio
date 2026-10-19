'use client'

import { useEffect, useRef, useState } from 'react'
import {
  canUseFileSystemAccess,
  isFileMissing,
  pickSaveLocation,
  writeProjectFile,
} from '@/components/file-handle'
import { useProject } from '@/components/ProjectProvider'
import { downloadBytes, projectNameFromFilename, safeFilename } from '@/components/viewer/download'
import { serializeProject } from '@/lib/editor/project-file'

/** 'none' = no dialog is open. */
type Dialog = 'none' | 'need-save-as' | 'save-as'

interface Message {
  kind: 'ok' | 'error'
  text: string
}

export function SaveBar() {
  const { state, dispatch, fileHandle, setFileHandle } = useProject()
  const [dialog, setDialog] = useState<Dialog>('none')
  const [message, setMessage] = useState<Message | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supported = canUseFileSystemAccess()

  // only clears the timer with no setState, so react-hooks/set-state-in-effect doesn't apply
  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  function flash(kind: Message['kind'], text: string) {
    setMessage({ kind, text })
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    // The success message disappears after 3 s, since a lingering "saved" after further edits
    // would mislead. Errors stay so there is time to read them
    if (kind === 'ok') {
      timer.current = setTimeout(() => setMessage(null), 3000)
    }
  }

  async function save() {
    if (fileHandle === null) {
      // Safeguard: never silently switch to Save As. Users would think they were overwriting a
      // file while actually creating another, which is exactly the problem this avoids
      setDialog('need-save-as')
      return
    }
    try {
      await writeProjectFile(fileHandle, serializeProject(state))
      flash('ok', `已儲存到 ${fileHandle.name}`)
    } catch (e) {
      if (isFileMissing(e)) {
        // the file is gone, so there is no point keeping a reference to it
        setFileHandle(null)
        flash('error', '原本的檔案已經不在了，請用「另存新檔」')
        return
      }
      flash('error', e instanceof Error ? e.message : String(e))
    }
  }

  async function saveAs(name: string) {
    setDialog('none')
    try {
      if (!supported) {
        const filename = safeFilename(name, 'psproj')
        const finalName = projectNameFromFilename(filename)
        // Serialize with the final name, not the old one in state: dispatch takes effect only on
        // the next render, so serializing first would save the old name and the title would not
        // match the file name on the next load
        downloadBytes(
          new TextEncoder().encode(serializeProject({ ...state, name: finalName })),
          filename,
          'application/json',
        )
        dispatch({ type: 'rename-project', name: finalName })
        flash('ok', `已下載 ${filename}`)
        return
      }

      const handle = await pickSaveLocation(safeFilename(name, 'psproj'))
      if (handle === null) {
        // the user cancelled in the system dialog; not an error, so do nothing
        return
      }
      // Trust what is on disk: the user may have renamed the file in the system dialog.
      // Read the final file name first so a consistent name goes into the file content
      const finalName = projectNameFromFilename(handle.name)
      await writeProjectFile(handle, serializeProject({ ...state, name: finalName }))
      setFileHandle(handle)
      dispatch({ type: 'rename-project', name: finalName })
      flash('ok', `已儲存到 ${handle.name}`)
    } catch (e) {
      flash('error', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <div className="flex items-center gap-3">
        <span className="opacity-70">{state.name}</span>
        <button
          onClick={() => void save()}
          disabled={!supported}
          className="rounded bg-current/10 px-4 py-2 transition hover:bg-current/20
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          儲存
        </button>
        <button
          onClick={() => setDialog('save-as')}
          className="rounded bg-current/10 px-4 py-2 transition hover:bg-current/20"
        >
          另存新檔
        </button>
      </div>

      {!supported && (
        <p className="text-xs opacity-60">這個瀏覽器不支援寫回原檔，請用「另存新檔」</p>
      )}

      {message && (
        <p className={`text-xs ${message.kind === 'ok' ? 'opacity-60' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}

      <NeedSaveAsDialog
        open={dialog === 'need-save-as'}
        // Close only if this dialog is really still the current one.
        // A plain onClose={() => setDialog('none')} breaks: pressing Save As first sets dialog to
        // 'save-as', the effect then close()s this dialog and fires its close event, and that
        // handler would set the state back to 'none', so the Save As dialog could never open
        onClose={() => setDialog((d) => (d === 'need-save-as' ? 'none' : d))}
        onSaveAs={() => setDialog('save-as')}
      />

      <SaveAsDialog
        open={dialog === 'save-as'}
        defaultName={state.name}
        onClose={() => setDialog((d) => (d === 'save-as' ? 'none' : d))}
        onSave={(name) => void saveAs(name)}
      />
    </div>
  )
}

/** Syncs the external <dialog> DOM API without touching React state. Shared by both dialogs. */
function useDialogSync(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return ref
}

function NeedSaveAsDialog({
  open,
  onClose,
  onSaveAs,
}: {
  open: boolean
  onClose: () => void
  onSaveAs: () => void
}) {
  const ref = useDialogSync(open)

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(26rem,90vw)] rounded-xl p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5 text-left">
        <h2 className="text-lg font-medium">這是尚未儲存的新專案</h2>
        <p className="text-sm opacity-70">
          要先指定儲存位置。之後按「儲存」就會直接寫回同一個檔案，不會再問。
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm opacity-70 hover:bg-current/10"
          >
            取消
          </button>
          <button
            onClick={onSaveAs}
            className="rounded bg-current/10 px-4 py-1.5 text-sm font-medium hover:bg-current/20"
          >
            另存新檔
          </button>
        </div>
      </div>
    </dialog>
  )
}

function SaveAsDialog({
  open,
  defaultName,
  onClose,
  onSave,
}: {
  open: boolean
  defaultName: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const ref = useDialogSync(open)

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(28rem,90vw)] rounded-xl p-0 backdrop:bg-black/40"
    >
      {/* key remounts the dialog on every open so the file name resets to the default.
          Resetting with setState in an effect causes cascading renders, which React advises against */}
      {open && (
        <SaveAsForm key={defaultName} defaultName={defaultName} onClose={onClose} onSave={onSave} />
      )}
    </dialog>
  )
}

function SaveAsForm({
  defaultName,
  onClose,
  onSave,
}: {
  defaultName: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)

  return (
    <div className="flex flex-col gap-4 p-5 text-left">
      <h2 className="text-lg font-medium">另存新檔</h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">專案名稱</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-current/20 bg-transparent px-2 py-1"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm opacity-70 hover:bg-current/10"
        >
          取消
        </button>
        <button
          onClick={() => onSave(name)}
          className="rounded bg-current/10 px-4 py-1.5 text-sm font-medium hover:bg-current/20"
        >
          儲存
        </button>
      </div>
    </div>
  )
}
