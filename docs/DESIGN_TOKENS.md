# Design Tokens — Manual Execution Guide

**Status**: Manual process (no automated token generator yet).  
**Scope**: Colors and values that flow from Supabase into the UI.  
**Last reviewed**: 2026-11-16.

---

## 1. Booking & Order Status Color Mapping

Each status type has a predefined Tailwind color. When adding a new status or changing an existing one, update **both** the TypeScript type **and** the color mapping below.

| Status Type | Value | Tailwind Class | File(s) |
| --- | --- | --- | --- |
| **BookingStatus** | `pending` | `bg-yellow-100 text-yellow-800` | `lib/types.ts`, `components/admin/BookingItemsPanel.tsx` |
| | `confirmed` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `done` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `cancelled` | `bg-red-100 text-red-800` | `lib/types.ts` |
| **ProjectStatus** | `not_started` | `bg-gray-300 text-gray-700` | `lib/types.ts` |
| | `preparing` | `bg-yellow-100 text-yellow-800` | `lib/types.ts` |
| | `ready` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `in_progress` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `returning` | `bg-purple-100 text-purple-800` | `lib/types.ts` |
| | `completed` | `bg-emerald-100 text-emerald-800` | `lib/types.ts` |
| **InvoiceStatus** | `draft` | `bg-gray-300 text-gray-700` | `lib/types.ts`, `components/admin/InvoiceManager.tsx` |
| | `issued` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `paid` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `void` | `bg-red-100 text-red-800` | `lib/types.ts` |
| **PurchaseOrderStatus** | `draft` | `bg-gray-300 text-gray-700` | `lib/types.ts` |
| | `ordered` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `partially_received` | `bg-yellow-100 text-yellow-800` | `lib/types.ts` |
| | `received` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `cancelled` | `bg-red-100 text-red-800` | `lib/types.ts` |
| **PlanStatus** | `draft` | `bg-gray-300 text-gray-700` | `lib/types.ts` |
| | `approved` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `in_progress` | `bg-yellow-100 text-yellow-800` | `lib/types.ts` |
| | `done` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `cancelled` | `bg-red-100 text-red-800` | `lib/types.ts` |
| **ChecklistStatus** | `pending` | `bg-yellow-100 text-yellow-800` | `lib/types.ts` |
| | `in_stock` | `bg-green-100 text-green-800` | `lib/types.ts` |
| | `need_order` | `bg-orange-100 text-orange-800` | `lib/types.ts` |
| | `done` | `bg-emerald-100 text-emerald-800` | `lib/types.ts` |
| **BookingStaffStatus** | `planned` | `bg-purple-100 text-purple-800` | `lib/types.ts` |
| | `confirmed` | `bg-blue-100 text-blue-800` | `lib/types.ts` |
| | `cancelled` | `bg-red-100 text-red-800` | `lib/types.ts` |
| **RentalStatus** | `reserved` | `bg-pink-100 text-pink-800` | `lib/types.ts` |
| | `checked_out` | `bg-yellow-100 text-yellow-800` | `lib/types.ts` |
| | `returned` | `bg-green-100 text-green-800` | `lib/types.ts` |

### How to manually update a status color

1. **Add/modify the type** in `lib/types.ts` (if new status).
2. **Add the Tailwind class** to the table above.
3. **Search for usages** of the old color class across `components/` and `app/`:  
   ```bash
   grep -rn "bg-yellow-100 text-yellow-800" --include="*.tsx" --include="*.ts" app/ components/ | grep -i "status\|status"
   ```
4. **Replace** the old class with the new one in each file found.
5. **Run verification**: `npm run typecheck && npm run lint && npm run build`.

---

## 2. Product Color Attribute (Supabase JSONB)

Products store a free-form `attributes` JSONB column in Supabase. One common key is `"color"`. The UI reads this value and applies a matching Tailwind color.

### Current convention (informal, enforced by code review)

| Supabase `attributes.color` value | Tailwind class | Example |
| --- | --- | --- |
| `red` | `bg-red-500` | Product card with red variant |
| `pink` | `bg-pink-500` | |
| `purple` | `bg-purple-500` | |
| `deep-purple` | `bg-purple-600` | |
| `indigo` | `bg-indigo-500` | |
| `blue` | `bg-blue-500` | |
| `light-blue` | `bg-blue-100` | |
| `cyan` | `bg-cyan-500` | |
| `teal` | `bg-teal-500` | |
| `green` | `bg-green-500` | |
| `light-green` | `bg-green-100` | |
| `lime` | `bg-lime-500` | |
| `yellow` | `bg-yellow-500` | |
| `amber` | `bg-amber-500` | |
| `orange` | `bg-orange-500` | |
| `deep-orange` | `bg-orange-600` | |
| `brown` | `bg-brown-500` | |
| `grey` | `bg-gray-500` | |
| `blue-grey` | `bg-gray-500` | |

### How to manually add a new product color

1. **Decide on the canonical name** (keep it short, no spaces; use `kebab-case` if multiple words).
2. **Add the mapping** to the table above.
3. **Find where product colors are rendered** (typically `components/landing/ProductCard.tsx` or admin product forms).
4. **Add a switch / mapping object** that maps the color string to a Tailwind class. Example pattern:

   ```tsx
   // In the component that renders the product color badge:
   const colorMap: Record<string, string> = {
     red: "bg-red-500",
     pink: "bg-pink-500",
     // ... other colors
     mynewcolor: "bg-orange-500", // newly added
   };

   const badgeClass = colorMap[product.attributes?.color ?? "grey"] || "bg-gray-300";
   ```

5. **Run verification**: `npm test && npm run build`.

---

## 3. Manual Token Refresh Checklist

Run this checklist whenever a status type is added/changed or a new product color is introduced:

- [ ] **Type check**: `npm run typecheck` — no new TypeScript errors.
- [ ] **Lint**: `npm run lint` — no new ESLint errors (7 pre-existing warnings about `setState-in-effect` are acceptable).
- [ ] **Tests**: `npm test` — all 4 date‑helper tests pass.
- [ ] **Build**: `npm run build` — succeeds, `/robots.txt` and `/sitemap.xml` generated.
- [ ] **Audit**: `npm audit --omit=dev` — 0 vulnerabilities (production deps only).
- [ ] **DB migration** (if schema changed): migrate Supabase migration file and regenerate types with `supabase gen types`.

---

## 4. Known Limitations

- **No automated generator** — all mappings are maintained manually in this document and the TypeScript types.  
- **Product color** is stored as a free‑form string in Supabase `attributes`; there is no enforced enum. This means any string can appear at runtime, so the `colorMap` default falls back to `bg-gray-300`.
- **Status types** are exhaustive TypeScript unions, so a new value will cause a compile error until it is added to the table above.

---
*This document is executed manually. To update a token, follow the steps in sections 1–3, then re‑run the verification checklist.*