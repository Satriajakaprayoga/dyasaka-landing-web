import Link from "next/link";
import PageTransition from "@/components/admin/PageTransition";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gray-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Lewati ke konten
      </a>
      <header className="border-b bg-white">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg">
            🎈 Dyasaka Decoration
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/catalog" className="hover:text-pink-600 transition">
              Katalog
            </Link>
            <Link
              href="/availability"
              className="hover:text-pink-600 transition"
            >
              Ketersediaan
            </Link>
          </div>
        </nav>
      </header>
      <PageTransition>{children}</PageTransition>
      <SiteFooter />
    </>
  );
}
