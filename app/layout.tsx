import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Sledge — Change Order Extraction",
  description:
    "Extract structured change-order data from PDF and text documents with field-level confidence scores. Text-based PDFs only — OCR not enabled.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col blueprint-bg">{children}</body>
    </html>
  );
}
