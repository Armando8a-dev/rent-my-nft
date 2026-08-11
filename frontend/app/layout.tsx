import type { Metadata } from "next";
import { Chakra_Petch, Rajdhani } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "RentMyNFT — Loot Vault",
  description: "Rent NFTs by the day. The vault escrows the item, the timer runs down on-chain, and the owner always gets it back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${chakra.variable} ${rajdhani.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
