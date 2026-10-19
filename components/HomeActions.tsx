'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'
import { DropZone } from '@/components/DropZone'
import { LoadingTransition } from '@/components/LoadingTransition'
import { canUseFileSystemAccess, openProjectFile } from '@/components/file-handle'
import { stashPendingProject } from '@/components/pending-project'
import { deserializeProject } from '@/lib/editor/project-file'

/** How long the loading transition shows before navigating; purely decorative, not real progress. */
const LOADING_TRANSITION_MS = 600

export function HomeActions() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** Show the transition first and navigate after a fixed delay, rather than overlaying it during navigation. */
  function goToStudio() {
    setLoading(true)
    setTimeout(() => router.push('/studio'), LOADING_TRANSITION_MS)
  }

  /** The final steps shared by the three entry points (button, hidden input, drag and drop). */
  function commit(text: string, handle: FileSystemFileHandle | null) {
    try {
      // Parse once to confirm the file is readable. If it can't be parsed, stay on the home
      // page rather than landing in an empty workspace that looks like a successful load
      deserializeProject(text)
      stashPendingProject(text, handle)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    goToStudio()
  }

  async function fromFile(file: File, handle: FileSystemFileHandle | null) {
    setError(null)
    let text: string
    try {
      text = await file.text()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    commit(text, handle)
  }

  /** Used when the File System Access API exists: it yields a writable handle, so Save can write back later. */
  async function fromPicker() {
    setError(null)
    let picked: Awaited<ReturnType<typeof openProjectFile>>
    try {
      picked = await openProjectFile()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    if (picked === null) {
      // the user cancelled; not an error
      return
    }
    commit(picked.text, picked.handle)
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Card
          variant="primary"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          }
          title="建立新專案"
          description="從空白開始建立新的封包專案"
          onClick={goToStudio}
        />

        <Card
          variant="deep"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 16V4m0 0L7 9m5-5 5 5" />
              <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
          }
          title="載入專案"
          description="載入已存的專案檔案（.psproj）"
          onClick={() => {
            if (canUseFileSystemAccess()) {
              void fromPicker()
              return
            }
            inputRef.current?.click()
          }}
        />
      </div>

      <DropZone
        label="或拖曳 .psproj 檔案到此處"
        onDrop={(entries) => void fromFile(entries[0].file, entries[0].handle)}
      />

      {/* Used by browsers without the File System Access API */}
      <input
        ref={inputRef}
        type="file"
        accept=".psproj"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void fromFile(file, null)
          }
          // clear it so the same file can be picked twice in a row
          e.target.value = ''
        }}
      />

      {error && (
        <p className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          載不進來：{error}
        </p>
      )}

      {loading && <LoadingTransition />}
    </div>
  )
}

/**
 * The whole card is the clickable entry point, like the XMNT web app's home cards
 * (card() in ui/view-home.js: a single <button> with onClick, no separate "enter"
 * button inside). Both cards use onClick, because "new project" must also show the
 * loading transition before navigating, so a plain <Link> jump won't do.
 */
function Card({
  icon,
  title,
  description,
  variant,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  variant: 'primary' | 'deep'
  onClick: () => void
}) {
  const cardBg =
    variant === 'primary'
      ? 'bg-card-primary hover:bg-card-primary-hover'
      : 'bg-card-deep hover:bg-card-deep-hover'
  const iconColor = variant === 'primary' ? 'text-brand' : 'text-brand-deep'

  // hover:[transform:none]: a <button> picks up the site-wide button:hover
  // transform: scale(1.05) (@layer base), which would stack with this card's own
  // hover:scale-[1.03] (Tailwind uses the separate scale property, so the two add up
  // rather than cancel). Overriding transform itself leaves only the card's own scaling.
  const className = `group flex flex-1 flex-col items-center gap-3 rounded-lg border-none p-6
                      text-center transition-transform duration-200 ease-out hover:scale-[1.03]
                      hover:[transform:none] motion-reduce:transition-none
                      motion-reduce:hover:scale-100 ${cardBg}`

  return (
    <button onClick={onClick} className={className}>
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-white
                    transition-transform duration-200 ease-out group-hover:scale-110
                    motion-reduce:transition-none motion-reduce:group-hover:scale-100
                    ${iconColor}`}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="mt-1 text-sm opacity-60">{description}</p>
      </div>
    </button>
  )
}
