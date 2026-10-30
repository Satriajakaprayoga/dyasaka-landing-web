import { createServerSupabase } from "@/lib/supabase-server";
import type { CompanyBankAccount, CompanyProfile } from "@/lib/types";
import CompanyProfileForm from "@/components/admin/CompanyProfileForm";
import BankAccountsPanel from "@/components/admin/BankAccountsPanel";
import { Breadcrumbs, Card, PageHeader } from "@/components/admin/ui";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();

  const [profileRes, banksRes] = await Promise.all([
    supabase.from("company_profile").select("*").limit(1).maybeSingle(),
    supabase
      .from("company_bank_accounts")
      .select("*")
      .order("sort_order"),
  ]);

  const profile = (profileRes.data ?? null) as CompanyProfile | null;
  const banks = (banksRes.data ?? []) as CompanyBankAccount[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Pengaturan" },
          ]}
        />
      </div>

      <PageHeader
        title="Pengaturan"
        subtitle="Profil perusahaan, logo, dan rekening bank untuk invoice"
      />

      {!profile ? (
        <Card className="p-5">
          <p className="text-sm text-red-600">
            Profil perusahaan belum ada — jalankan migrasi §8 terlebih
            dahulu.
          </p>
        </Card>
      ) : (
        <Card className="mb-6 p-5">
          <CompanyProfileForm profile={profile} />
        </Card>
      )}

      <Card className="p-5">
        <BankAccountsPanel initialAccounts={banks} />
      </Card>
    </div>
  );
}
