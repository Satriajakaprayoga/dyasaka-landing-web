import { SectionHeading } from "./SectionHeading";

const FAQS = [
  {
    question: "Berapa lama proses pemasangan dekorasi?",
    answer:
      "Pemasangan biasanya memakan waktu 1–3 jam tergantung skala paket. Kami selalu datang lebih awal agar dekorasi siap sebelum acara dimulai.",
  },
  {
    question: "Apakah bisa request tema atau custom dekorasi?",
    answer:
      "Tentu bisa! Ceritakan tema yang Anda inginkan saat konsultasi WhatsApp — kami akan bantu wujudkan, mulai dari warna balon, bentuk instalasi, sampai aksesori tambahan.",
  },
  {
    question: "Bagaimana cara melakukan booking?",
    answer:
      "Pilih paket di katalog, klik tombol WhatsApp untuk konsultasi, lalu lakukan booking dan pembayaran DP. Tanggal Anda langsung kami amankan setelah DP diterima.",
  },
  {
    question: "Berapa DP yang diperlukan untuk booking?",
    answer:
      "DP yang kami minta tergantung nilai paket dan akan diinformasikan oleh admin saat konsultasi. Sisa pembayaran dapat dilakukan setelah dekorasi terpasang.",
  },
  {
    question: "Apakah tim Dyasaka juga membongkar dekorasi?",
    answer:
      "Ya, untuk paket dengan peralatan sewa (seperti backdrop atau rangka balon), tim kami akan kembali ke lokasi untuk membongkar dan menjemput peralatan sesuai jadwal yang disepakati.",
  },
] as const;

export function FaqSection() {
  return (
    <section className="bg-gradient-to-b from-white to-pink-50/50 py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading
          eyebrow="FAQ"
          title="Pertanyaan yang Sering Diajukan"
          description="Belum menemukan jawabannya? Hubungi kami via WhatsApp."
        />
        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-gray-200 bg-white transition open:border-pink-300 hover:border-pink-200"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 text-pink-500 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-gray-500">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
