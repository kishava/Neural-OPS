import { JetBrains_Mono, Space_Grotesk, Orbitron } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { Providers } from "@/providers/Providers";
import { enforceEnvironmentIfStrict } from "@/lib/env/validation";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Enterprise Risk & Decision Operating System`,
  description: APP_SUBTITLE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  enforceEnvironmentIfStrict();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`dark bg-neural-bg ${jetbrains.variable} ${spaceGrotesk.variable} ${orbitron.variable}`}>
      <body className="h-full md:overflow-hidden overflow-auto font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
