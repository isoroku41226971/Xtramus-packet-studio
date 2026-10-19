import { CursorGlow } from '@/components/CursorGlow'
import { HomeActions } from '@/components/HomeActions'

export default function Home() {
  return (
    <div className="home-hero flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="home-deco home-deco-circle" />
      <div className="home-deco home-deco-square" />
      <CursorGlow />
      <div className="home-content flex flex-1 flex-col items-center justify-center">
        {/* display: contents (Tailwind's contents class) keeps the <header>'s semantic
            grouping without creating its own layout box: the h1, tagline and description
            become flex children of .home-content and share its 18px gap, so (as in the XMNT
            web app) these lines follow the same spacing rhythm as the cards below instead of
            forming a separate block. */}
        <header className="contents text-center">
          <h1 className="font-heading">Packet Studio</h1>
          <p className="home-fullname">Packet Generation and Configuration</p>
          <p className="home-subtitle">建立、編輯、預覽與產生網路封包（PCAP）</p>
        </header>

        <HomeActions />
      </div>
    </div>
  )
}
