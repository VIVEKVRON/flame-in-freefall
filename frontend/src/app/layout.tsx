import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ParallaxStarfield } from "@/components/animations/ParallaxStarfield";
import { CustomCursor } from "@/components/ui/CustomCursor";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flame in Freefall | NASA Space Apps 2026",
  description:
    "SI-powered microgravity combustion telemetry dashboard and scroll-bound spacecraft narrative.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-space-black text-white antialiased selection:bg-flame-orange/35 selection:text-white"
      >
        <CustomCursor />
        <ParallaxStarfield />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
