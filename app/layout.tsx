import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
