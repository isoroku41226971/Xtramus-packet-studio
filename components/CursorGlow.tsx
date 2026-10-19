'use client'

import { useEffect, useRef } from 'react'

const FOLLOW_FACTOR = 0.08
const SETTLE_PX = 0.5
const ROTATE_DEG = 12

/**
 * Cursor-following glow on the home page hero. Purely decorative; it affects no
 * interaction logic.
 *
 * It sits in the hero container (see app/page.tsx) as an ordinary child, with its
 * listeners on its parentElement (the hero container). useEffect with an empty
 * dependency array runs only on mount, so unlike the XMNT web app's vanilla DOM
 * version (ui/cursor-glow.js), there is no need to guard against the element being
 * re-created; that problem only exists when vanilla DOM rebuilds children on every
 * render().
 *
 * With prefers-reduced-motion or on touch devices without a mouse (pointer: coarse)
 * it stays disabled: the element keeps the CSS default opacity: 0 and no listeners
 * are attached.
 */
export function CursorGlow() {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = elRef.current
    const container = el?.parentElement
    if (!el || !container) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (matchMedia('(pointer: coarse)').matches) return

    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let rafId: number | null = null

    function paint() {
      el!.style.transform = `translate(${curX}px, ${curY}px) rotate(${ROTATE_DEG}deg)`
    }

    function frame() {
      curX += (targetX - curX) * FOLLOW_FACTOR
      curY += (targetY - curY) * FOLLOW_FACTOR
      paint()
      const settled = Math.abs(targetX - curX) < SETTLE_PX && Math.abs(targetY - curY) < SETTLE_PX
      if (settled) {
        rafId = null
        return
      }
      rafId = requestAnimationFrame(frame)
    }

    function ensureRunning() {
      if (rafId == null) rafId = requestAnimationFrame(frame)
    }

    function overContent(target: EventTarget | null) {
      return target instanceof Element && target.closest('.home-content') != null
    }

    function onMouseEnter(e: MouseEvent) {
      const r = container!.getBoundingClientRect()
      curX = targetX = e.clientX - r.left
      curY = targetY = e.clientY - r.top
      paint()
      el!.style.opacity = overContent(e.target) ? '0' : '1'
    }

    function onMouseMove(e: MouseEvent) {
      const r = container!.getBoundingClientRect()
      targetX = e.clientX - r.left
      targetY = e.clientY - r.top
      el!.style.opacity = overContent(e.target) ? '0' : '1'
      ensureRunning()
    }

    function onMouseLeave() {
      el!.style.opacity = '0'
    }

    container.addEventListener('mouseenter', onMouseEnter)
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    return () => {
      container.removeEventListener('mouseenter', onMouseEnter)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  return <div ref={elRef} className="home-deco home-cursor-glow" aria-hidden="true" />
}
