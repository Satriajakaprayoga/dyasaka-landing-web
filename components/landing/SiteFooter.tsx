import Link from "next/link";
import { buildGeneralWhatsAppLink } from "@/lib/booking-helpers";

const waLink = buildGeneralWhatsAppLink();

export function SiteFooter() {
  return (
    <footer className="border-t bg-gradient-to-b from-white to-pink-50/50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              🎈 Dyasaka Decoration
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
              Dekorasi balon untuk ulang tahun, pernikahan, baby shower, dan
              acara spesial lainnya.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-900">
              Jelajahi
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li>
                <Link href="/" className="transition hover:text-pink-600">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/catalog" className="transition hover:text-pink-600">
                  Katalog
                </Link>
              </li>
              <li>
                <Link
                  href="/availability"
                  className="transition hover:text-pink-600"
                >
                  Ketersediaan
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-900">
              Kontak
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              {waLink && (
                <li>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-pink-600"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              <li>Jakarta, Indonesia</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Dyasaka Decoration. Semua hak
          dilindungi.
        </div>
      </div>
    </footer>
  );
}
