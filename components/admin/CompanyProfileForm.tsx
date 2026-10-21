"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/compress-image";
import type { CompanyProfile } from "@/lib/types";
import {
  btnPrimary,
  inputClass,
  labelClass,
} from "./ui";
import { ImageIcon } from "./icons";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 10;

type Props = { profile: CompanyProfile };

export default function CompanyProfileForm({ profile }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    company_name: profile.company_name,
    address: profile.address ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    instagram_url: profile.instagram_url ?? "",
    facebook_url: profile.facebook_url ?? "",
    tiktok_url: profile.tiktok_url ?? "",
  });
  const [logoUrl, setLogoUrl] = useState(profile.logo_url);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Best-effort removal of the previous logo object (ProductForm pattern). */
  async function deleteOldLogo(url: string) {
    const path = url.split("/company-assets/")[1];
    if (path) {
      await supabase.storage.from("company-assets").remove([path]);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Logo harus berupa JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ukuran logo maksimal ${MAX_FILE_MB}MB.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const compressed = await compressImage(file, 800);
      const ext =
        compressed.type === "image/png"
          ? "png"
          : compressed.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `logo/${Date.now()}-logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(path, compressed);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("company-assets")
        .getPublicUrl(path);
      const newUrl = data.publicUrl;

      const res = await fetch("/api/admin/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: newUrl }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menyimpan logo");
      }

      const oldUrl = logoUrl;
      setLogoUrl(newUrl);
      setSaved(true);
      router.refresh();

      if (oldUrl) await deleteOldLogo(oldUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah logo");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveLogo() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: "" }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menghapus logo");
      }

      const oldUrl = logoUrl;
      setLogoUrl(null);
      router.refresh();

      if (oldUrl) await deleteOldLogo(oldUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus logo");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menyimpan pengaturan");
      }

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Profil Perusahaan
      </h2>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo perusahaan"
            className="h-20 w-20 rounded-lg border border-gray-200 object-contain"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-300">
            <ImageIcon className="h-6 w-6" />
          </span>
        )}
        <div className="space-y-1.5">
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className={btnPrimary}
            >
              {logoUrl ? "Ganti Logo" : "Unggah Logo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>
          {logoUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={saving}
              className="text-xs font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50"
            >
              Hapus logo
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="company_name" className={labelClass}>
          Nama Perusahaan
        </label>
        <input
          id="company_name"
          type="text"
          required
          value={form.company_name}
          onChange={(e) => update("company_name", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="address" className={labelClass}>
          Alamat
        </label>
        <textarea
          id="address"
          rows={2}
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Telepon
          </label>
          <input
            id="phone"
            type="text"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="instagram_url" className={labelClass}>
            Instagram
          </label>
          <input
            id="instagram_url"
            type="url"
            placeholder="https://instagram.com/…"
            value={form.instagram_url}
            onChange={(e) => update("instagram_url", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="facebook_url" className={labelClass}>
            Facebook
          </label>
          <input
            id="facebook_url"
            type="url"
            placeholder="https://facebook.com/…"
            value={form.facebook_url}
            onChange={(e) => update("facebook_url", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="tiktok_url" className={labelClass}>
            TikTok
          </label>
          <input
            id="tiktok_url"
            type="url"
            placeholder="https://tiktok.com/…"
            value={form.tiktok_url}
            onChange={(e) => update("tiktok_url", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Tersimpan</span>
        )}
      </div>
    </form>
  );
}
