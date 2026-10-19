'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { nextIndex } from '@/lib/listbox-nav'

export interface ListboxOption {
  value: string
  label: string
}

interface Props {
  options: ListboxOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Custom dropdown replacing native <select>, modeled on the XMNT web app's
 * ui/view-listbox.js: a trigger button, a floating panel, a rotating chevron, an
 * open/close animation and full keyboard navigation.
 *
 * value/onChange are fully controlled by the caller. Unlike the XMNT web app, which
 * keeps its own currentValue (a workaround needed in vanilla JS without React's
 * diffing and re-rendering), callers here are already controlled.
 */
export function Listbox({ options, value, onChange, disabled = false }: Props) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)

  // open: whether the panel is mounted in the portal. visible: whether the .open class is
  // applied (triggering the CSS transition). The two steps put a render between mounting and
  // starting the transition; otherwise the browser merges both changes into one style
  // calculation and jumps straight to the transition's end state with no animation. The XMNT
  // web app forces a synchronous reflow with void panel.offsetHeight for the same purpose;
  // here setTimeout(0) lets the browser paint once before the class changes.
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const currentLabel = options.find((o) => o.value === value)?.label ?? '(未選)'

  function openPanel() {
    if (open || disabled) return
    const trigger = triggerRef.current
    if (!trigger) return
    // Looked up on every open, not cached: a <dialog> opened with showModal() is promoted to
    // the browser's top layer, where anything outside it is covered and unclickable whatever
    // its z-index, so the panel must be portaled into the trigger's nearest dialog.
    setPortalTarget(trigger.closest('dialog') ?? document.body)
    const r = trigger.getBoundingClientRect()
    setRect({ left: r.left, top: r.bottom + 4, width: r.width })
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function closePanel(refocusTrigger = false) {
    if (!open) return
    setVisible(false)
    if (refocusTrigger) triggerRef.current?.focus()
  }

  function choose(index: number) {
    const picked = options[index]
    if (!picked) return
    onChange(picked.value)
    closePanel(true)
  }

  // add .open one tick after mounting so the transition actually plays
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setVisible(true), 0)
    return () => clearTimeout(timer)
  }, [open])

  // when visible turns false (closing), wait for the transition to finish, with a 200 ms
  // fallback (with prefers-reduced-motion the transition is skipped, and this ensures unmounting)
  useEffect(() => {
    if (!open || visible) return
    const panel = panelRef.current
    const unmount = () => setOpen(false)
    panel?.addEventListener('transitionend', unmount, { once: true })
    const timer = setTimeout(unmount, 200)
    return () => {
      panel?.removeEventListener('transitionend', unmount)
      clearTimeout(timer)
    }
  }, [open, visible])

  // Close on outside click. Options are <li> elements, not focusable, so clicking one never
  // moves focus off the trigger and blur/focusout cannot tell "clicked an option" from
  // "clicked outside"; a document-level click listener with ref.contains decides instead.
  useEffect(() => {
    if (!open) return
    function onDocumentClick(ev: MouseEvent) {
      const target = ev.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      closePanel()
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleTriggerKeyDown(ev: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        openPanel()
      }
      return
    }
    if (ev.key === 'Escape') {
      ev.preventDefault()
      closePanel(true)
      return
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      choose(activeIndex)
      return
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault()
      setActiveIndex(nextIndex(activeIndex, ev.key, options.length))
    }
  }

  const activeDescendantId = open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined

  return (
    <div className={`listbox ${visible ? 'open' : ''}`}>
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props --
          "A button that controls an external listbox" is a pattern endorsed by the WAI-ARIA APG
          (collapsible dropdown listbox): aria-activedescendant on the trigger points at the
          keyboard-highlighted option. This is not a misuse of a standalone role=button; it is
          the same pattern as the XMNT web app's trigger.setAttribute('aria-activedescendant', ...). */}
      <button
        ref={triggerRef}
        type="button"
        className="listbox-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={activeDescendantId}
        onClick={() => (open ? closePanel(true) : openPanel())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="listbox-label">{currentLabel}</span>
        <span className="listbox-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open &&
        portalTarget &&
        createPortal(
          <ul
            ref={panelRef}
            id={id}
            role="listbox"
            className={`listbox-panel ${visible ? 'open' : ''}`}
            style={{ left: rect.left, top: rect.top, width: rect.width }}
          >
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={option.value === value}
                className={`listbox-option ${i === activeIndex ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(i)}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          portalTarget,
        )}
    </div>
  )
}
