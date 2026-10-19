/**
 * Loading transition from the home page to the workspace. Purely decorative; how long it
 * shows is controlled by the caller (goToStudio in HomeActions). This component only draws
 * the screen and has no timing logic: rendered means "show now", unmounted means "hide".
 */
export function LoadingTransition() {
  return (
    <div className="loading-transition">
      <div className="loading-transition-box">
        <div className="loading-transition-brand">Xtramus</div>
        <div className="loading-transition-msg">正在進入…</div>
      </div>
    </div>
  )
}
