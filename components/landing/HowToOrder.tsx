import { SectionHeading } from "./SectionHeading";

const STEPS = [
  {
    title: "Pilih Paket",
    description:
      "Jelajahi katalog dan temukan paket dekorasi yang cocok untuk acara Anda.",
  },
  {
    title: "Konsultasi WhatsApp",
    description:
      "Diskusikan tema, tanggal, dan kebutuhan khusus langsung dengan admin kami.",
  },
  {
    title: "Booking & DP",
    description:
      "Amankan tanggal acara Anda dengan mudah melalui booking dan DP.",
  },
  {
    title: "Kami Pasang di Lokasi",
    description:
      "Tim kami datang dan memasang dekorasi tepat waktu di lokasi acara Anda.",
  },
] as const;

export function HowToOrder() {
  return (
    <section className="bg-gradient-to-b from-white to-pink-50/50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Cara Pesan"
          title="Pesan Dekorasi dalam 4 Langkah"
          description="Proses pemesanan yang sederhana — dari memilih paket sampai dekorasi terpasang di lokasi Anda."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="absolute left-full top-10 hidden h-0 w-4 border-t-2 border-dashed border-pink-200 lg:block"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 font-bold text-pink-700">
                {index + 1}
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
