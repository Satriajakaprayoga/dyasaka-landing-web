import Link from "next/link";
import PageTransition from "@/components/admin/PageTransition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
    </>
  );
}
