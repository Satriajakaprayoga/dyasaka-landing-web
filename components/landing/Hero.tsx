import Link from "next/link";
import { BalloonIcon } from "@/components/BalloonIcon";

// Fixed literal decor values — no Math.random() so SSR and client markup match.
const BALLOONS = [
  { position: "left-[4%] top-24", size: "h-24 w-24", tone: "text-pink-300", delay: "0s", duration: "7s" },
  { position: "right-[6%] top-16", size: "h-40 w-40", tone: "text-pink-300/60", delay: "1.2s", duration: "8s" },
  { position: "left-[20%] bottom-10", size: "h-12 w-12", tone: "text-rose-300", delay: "2.4s", duration: "6.5s" },
] as const;

const CONFETTI = [
  { position: "left-[12%] top-[30%]", color: "bg-pink-400", size: "h-2 w-2", delay: "0.5s" },
  { position: "left-[28%] top-[14%]", color: "bg-amber-300", size: "h-1.5 w-1.5", delay: "1.2s" },
  { position: "right-[22%] top-[42%]", color: "bg-sky-300", size: "h-2 w-2", delay: "2s" },
  { position: "right-[34%] top-[10%]", color: "bg-pink-300", size: "h-1.5 w-1.5", delay: "0.8s" },
  { position: "left-[46%] top-[6%]", color: "bg-amber-200", size: "h-2 w-2", delay: "1.8s" },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-b-[3rem] bg-gradient-to-b from-pink-100 via-pink-50 to-white">
      {BALLOONS.map((b, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`animate-balloon-drift absolute ${b.position}`}
          style={{ animationDelay: b.delay, animationDuration: b.duration }}
        >
          <BalloonIcon className={`${b.size} ${b.tone}`} />
        </div>
      ))}
      {CONFETTI.map((c, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`animate-confetti-fall absolute ${c.position} ${c.color} ${c.size} rounded-full`}
          style={{ animationDelay: c.delay }}
        />
      ))}

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-pink-600 shadow-sm">
          🎈 Dekorasi Balon Premium
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
          Wujudkan <span className="text-pink-600">Momen Spesial</span> dengan
          Dekorasi Balon Impian
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
          Ulang tahun, pernikahan, baby shower, atau acara kantor — kami bantu
          wujudkan dekorasi balon impian Anda.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/catalog"
            className="rounded-full bg-pink-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-600/25 transition hover:bg-pink-700 active:scale-95"
          >
            Lihat Katalog
          </Link>
          <Link
            href="/availability"
            className="rounded-full border border-pink-200 bg-white/80 px-7 py-3 text-sm font-semibold text-pink-700 transition hover:border-pink-300 hover:bg-white active:scale-95"
          >
            Cek Ketersediaan
          </Link>
        </div>
      </div>
    </section>
  );
}
