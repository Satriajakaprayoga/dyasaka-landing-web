"use client";

// This boundary replaces the root layout, so Tailwind's stylesheet may not
// be present. Layout is inline to stay readable either way.
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  textAlign: "center",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: "#1f2937",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>
        <main style={pageStyle}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
            Aplikasi gagal dimuat
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#4b5563" }}>
            Terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#fff",
              background: "#db2777",
              border: 0,
              borderRadius: "0.75rem",
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#6b7280" }}>
            Kode kesalahan: {error.digest ?? "tidak tersedia"}
          </p>
        </main>
      </body>
    </html>
  );
}
