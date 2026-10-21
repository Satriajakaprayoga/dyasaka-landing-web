import { SectionHeading } from "./SectionHeading";

const TESTIMONIALS = [
  {
    quote:
      "Dekorasinya cantik banget! Semua tamu memuji dekorasi pernikahan kami. Pemasangan cepat dan timnya ramah sekali.",
    name: "Rina & Budi",
    event: "Pernikahan",
  },
  {
    quote:
      "Balon ulang tahun anakku sesuai ekspektasi. Warna-warninya cerah dan fotogenik banget. Recommended!",
    name: "Sari Wulandari",
    event: "Ulang Tahun Anak",
  },
  {
    quote:
      "Booking gampang, admin responsif, dan harganya masuk anggaran kantor. Acara gathering kami jadi meriah.",
    name: "Pak Andi",
    event: "Acara Kantor",
  },
] as const;

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <SectionHeading
        eyebrow="Testimoni"
        title="Kata Mereka tentang Dyasaka"
        description="Kepercayaan pelanggan adalah prioritas kami."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <figure
            key={testimonial.name}
            className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-amber-400" aria-label="Rating 5 dari 5 bintang">
              &starf;&starf;&starf;&starf;&starf;
            </p>
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 font-bold text-pink-700"
              >
                {testimonial.name.charAt(0)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  {testimonial.name}
                </span>
                <span className="block text-xs text-gray-500">
                  {testimonial.event}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
