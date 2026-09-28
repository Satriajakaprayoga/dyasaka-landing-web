import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
