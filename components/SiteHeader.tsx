import Link from 'next/link'

/**
 * Site-wide header, matching the XMNT web app's header: a brand-blue background
 * `#15A8DE` (bg-brand) and a logo without an accent-colored "X" (the real company
 * logo is all blue/dark blue).
 *
 * The "Test Instruments and Networks" tagline lives on the home page
 * (.home-fullname, in the same visual style as the XMNT web app's "Xtramus Modular
 * Network Testing"); like the XMNT web app's ui/chrome.js, the header holds only the logo.
 *
 * Sizes match the XMNT web app's .site-header/.brand (padding: 10px 16px,
 * font-size: 17px, font-weight: 600) with a single text run instead of two spans of
 * different sizes. leading-[1.6]: the XMNT web app's .brand inherits body's unitless
 * line-height of 1.6 (27.2px at 17px; unitless line-heights inherit the ratio, not a
 * computed px value). Setting 1.6 on body here would affect every text without an
 * explicit line-height across the site, so it is set on this text only, giving the
 * same height without side effects.
 */
export function SiteHeader() {
  return (
    <header className="bg-brand text-white">
      <div className="flex items-center px-4 py-2.5">
        <Link
          href="/"
          className="-mx-2 -my-1 rounded-md px-2 py-1 text-[17px] font-semibold leading-[1.6]
                     transition-[transform,background-color] duration-200 ease-out
                     hover:scale-105 hover:bg-white/14
                     motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          Xtramus Packet Studio
        </Link>
      </div>
    </header>
  )
}
