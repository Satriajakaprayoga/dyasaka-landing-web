import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dyasaka Decoration",
  description: "Dekorasi balon untuk acara spesial Anda",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <header className="border-b">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">
              🎈 Dyasaka Decoration
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/catalog">Katalog</Link>
              <Link href="/availability">Ketersediaan</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
