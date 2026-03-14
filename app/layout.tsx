import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Poachland — The Ultimate Frisbee Marketplace",
  description:
    "Buy, sell, and trade ultimate frisbee jerseys and discs. Community-built, trust-first.",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: ["ultimate frisbee", "jerseys", "discs", "trade", "collector"],
  openGraph: {
    title: "Poachland",
    description: "The ultimate frisbee collector marketplace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e0e0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background" style={{ colorScheme: "dark" }}>
      <body
        className={`${inter.variable} ${barlow.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
