import Link from "next/link";
import { buildGeneralWhatsAppLink } from "@/lib/booking-helpers";

export function CtaBand() {
  const waLink = buildGeneralWhatsAppLink();
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <div className="rounded-[2rem] bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Siap dekorasi momen spesial Anda?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-pink-100 sm:text-base">
          Konsultasikan kebutuhan dekorasi Anda sekarang — tim kami siap
          membantu mewujudkannya.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-pink-700 shadow-lg transition hover:bg-pink-50 active:scale-95"
            >
              Chat via WhatsApp
            </a>
          )}
          <Link
            href="/availability"
            className="rounded-full border border-white/60 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
          >
            Cek Ketersediaan
          </Link>
        </div>
      </div>
    </section>
  );
}
