import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";

export const metadata = {
  title: "Ketersediaan Tanggal | Balloon Party Planner",
};

export default function AvailabilityPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Ketersediaan Tanggal</h1>
      <p className="text-gray-500 mb-6">
        Cek tanggal yang masih tersedia sebelum menghubungi kami via WhatsApp.
      </p>
      <AvailabilityCalendar monthsAhead={7} />
    </main>
  );
}
