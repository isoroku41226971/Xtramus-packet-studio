import type { Metadata } from "next";
import { Roboto, Noto_Sans_TC, Huninn } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const huninn = Huninn({
  variable: "--font-huninn",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Packet Studio",
  description: "建立、編輯、預覽與產生網路封包（PCAP）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${notoSansTC.variable} ${huninn.variable} h-full antialiased`}
    >
      {/* The header and footer live in the root layout so every page gets them.
          The middle uses flex-1 to fill the remaining height, keeping the footer at the bottom. */}
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
