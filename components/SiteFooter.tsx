/**
 * Site-wide footer, matching the XMNT web app's footer: a faint grey top border,
 * centered 12px text at 50% opacity. The border color `rgba(127,127,127,0.25)` is the
 * exact value from the XMNT web app's `.site-footer`, matched with a Tailwind arbitrary
 * value rather than an approximate grey utility class.
 *
 * leading-[1.6]: the XMNT web app's .site-footer has no line-height of its own and
 * inherits body's unitless 1.6 (19.2px at 12px). Tailwind's text-xs sets a fixed 16px
 * line-height that overrides that ratio and made the footer 3px shorter, so the same
 * ratio is restored here.
 */
export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-[rgba(127,127,127,0.25)] px-3 py-3 text-center text-xs leading-[1.6] opacity-50">
      © {new Date().getFullYear()} Xtramus
    </footer>
  )
}
