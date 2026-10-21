"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CompanyBankAccount } from "@/lib/types";
import {
  btnPrimary,
  inputClass,
} from "./ui";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";
import ConfirmModal from "./ConfirmModal";

type Props = { initialAccounts: CompanyBankAccount[] };

export default function BankAccountsPanel({ initialAccounts }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [drafts, setDrafts] = useState<Record<string, {
    bank_name: string;
    account_holder: string;
    account_number: string;
  }>>(() =>
    Object.fromEntries(
      initialAccounts.map((a) => [
        a.id,
        {
          bank_name: a.bank_name,
          account_holder: a.account_holder,
          account_number: a.account_number,
        },
      ]),
    ),
  );

  const [newAccount, setNewAccount] = useState({
    bank_name: "",
    account_holder: "",
    account_number: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CompanyBankAccount | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  function updateDraft(
    id: string,
    key: "bank_name" | "account_holder" | "account_number",
    value: string,
  ) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  async function loadAccounts() {
    const { data } = await supabase
      .from("company_bank_accounts")
      .select("*")
      .order("sort_order");
    const rows = (data ?? []) as CompanyBankAccount[];
    setAccounts(rows);
    setDrafts(
      Object.fromEntries(
        rows.map((a) => [
          a.id,
          {
            bank_name: a.bank_name,
            account_holder: a.account_holder,
            account_number: a.account_number,
          },
        ]),
      ),
    );
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menambah rekening");
      }
      setNewAccount({ bank_name: "", account_holder: "", account_number: "" });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah rekening");
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError(null);

    try {
      const res = await fetch("/api/admin/bank-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menyimpan rekening");
      }
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan rekening");
    } finally {
      setBusyId(null);
    }
  }

  /** Swap sort_order with the neighbour, then persist both rows. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= accounts.length) return;

    const a = accounts[index];
    const b = accounts[target];
    setBusyId(a.id);
    setError(null);

    try {
      for (const [account, sortOrder] of [
        [a, b.sort_order],
        [b, a.sort_order],
      ] as const) {
        const res = await fetch("/api/admin/bank-accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: account.id, sort_order: sortOrder }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "Gagal mengurutkan rekening");
        }
      }
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengurutkan rekening");
    } finally {
      setBusyId(null);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/bank-accounts?id=${confirmDelete.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Gagal menghapus rekening");
      }
      setConfirmDelete(null);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus rekening");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-gray-900">
        Rekening Bank
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Hanya rekening aktif yang bisa dipilih saat menerbitkan invoice.
        Urutan atas muncul lebih dulu.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {accounts.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {accounts.map((a, i) => {
            const draft = drafts[a.id] ?? {
              bank_name: a.bank_name,
              account_holder: a.account_holder,
              account_number: a.account_number,
            };
            const dirty =
              draft.bank_name !== a.bank_name ||
              draft.account_holder !== a.account_holder ||
              draft.account_number !== a.account_number;

            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label="Naikkan urutan"
                    disabled={i === 0 || busyId === a.id}
                    onClick={() => move(i, -1)}
                    className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
                  >
                    <ChevronUpIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Turunkan urutan"
                    disabled={i === accounts.length - 1 || busyId === a.id}
                    onClick={() => move(i, 1)}
                    className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    aria-label="Nama bank"
                    value={draft.bank_name}
                    onChange={(e) => updateDraft(a.id, "bank_name", e.target.value)}
                    className={inputClass + " py-1.5"}
                  />
                  <input
                    type="text"
                    aria-label="Pemilik rekening"
                    value={draft.account_holder}
                    onChange={(e) =>
                      updateDraft(a.id, "account_holder", e.target.value)
                    }
                    className={inputClass + " py-1.5"}
                  />
                  <input
                    type="text"
                    aria-label="Nomor rekening"
                    value={draft.account_number}
                    onChange={(e) =>
                      updateDraft(a.id, "account_number", e.target.value)
                    }
                    className={inputClass + " py-1.5"}
                  />
                </div>

                <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={a.is_active}
                    disabled={busyId === a.id}
                    onChange={(e) =>
                      patch(a.id, { is_active: e.target.checked })
                    }
                  />
                  Aktif
                </label>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={!dirty || busyId === a.id}
                    onClick={() => patch(a.id, draft)}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === a.id ? "…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus rekening ${a.bank_name}`}
                    disabled={busyId === a.id}
                    onClick={() => setConfirmDelete(a)}
                    className="rounded-lg px-2.5 py-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nama bank"
          required
          value={newAccount.bank_name}
          onChange={(e) =>
            setNewAccount((n) => ({ ...n, bank_name: e.target.value }))
          }
          className={inputClass + " w-36 flex-1"}
        />
        <input
          type="text"
          placeholder="Pemilik rekening"
          required
          value={newAccount.account_holder}
          onChange={(e) =>
            setNewAccount((n) => ({ ...n, account_holder: e.target.value }))
          }
          className={inputClass + " w-44 flex-1"}
        />
        <input
          type="text"
          placeholder="Nomor rekening"
          required
          value={newAccount.account_number}
          onChange={(e) =>
            setNewAccount((n) => ({ ...n, account_number: e.target.value }))
          }
          className={inputClass + " w-40 flex-1"}
        />
        <button type="submit" disabled={adding} className={btnPrimary + " shrink-0"}>
          <PlusIcon className="h-4 w-4" />
          Tambah
        </button>
      </form>

      <ConfirmModal
        open={confirmDelete !== null}
        title={
          confirmDelete
            ? `Hapus rekening ${confirmDelete.bank_name} ${confirmDelete.account_number}?`
            : ""
        }
        description="Invoice yang sudah diterbitkan tetap menampilkan rekening tersalinnya; hanya pilihan untuk invoice baru yang hilang."
        busy={deleting}
        onConfirm={performDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
