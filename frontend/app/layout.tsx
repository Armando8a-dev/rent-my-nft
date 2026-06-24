import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentMyNFT — Peer-to-peer NFT Rentals",
  description: "List your NFT for rent, set a price per day. Renters pay in ETH — escrow handled by smart contract.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
