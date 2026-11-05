export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  // Admin-only columns — the anon column grants on products exclude them.
  vendor_id: string | null;
  vendor_price: number | null;
  is_active: boolean;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
};

export type DateCapacity = {
  event_date: string; // ISO date, e.g. "2026-09-15"
  max_capacity: number;
  booked_count: number;
};

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled';

export type ProjectStatus =
  | 'not_started'
  | 'preparing'
  | 'ready'
  | 'in_progress'
  | 'returning'
  | 'completed';

export type Booking = {
  id: string;
  // Null = custom booking assembled per-item by the admin.
  product_id: string | null;
  customer_name: string;
  phone: string;
  event_date: string;
  event_address: string;
  theme: string | null;
  message: string | null;
  status: BookingStatus;
  project_status: ProjectStatus;
  dp_received_at: string | null;
  transport_fee: number | null;
};

// ---------- Item master data ----------

export type ItemType = 'consumable' | 'rentable';

export type Vendor = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: string;
  item_category: string;
  name: string;
  type: ItemType;
  pieces_per_unit: number | null;
  quantity_owned: number;
};

export type ItemVariant = {
  id: string;
  item_id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  stock_quantity: number;
  current_price: number;
  // Internal — what one unit costs the business; margin reports only.
  cost_price: number | null;
  reorder_point: number | null;
};

export type ItemPriceHistory = {
  id: string;
  item_variant_id: string;
  price: number;
  effective_from: string;
};

export type StockMovementType =
  | 'restock'
  | 'usage'
  | 'damaged'
  | 'lost'
  | 'adjustment'
  | 'purchased';

export type StockMovement = {
  id: string;
  item_variant_id: string;
  type: StockMovementType;
  quantity: number;
  booking_id: string | null;
  note: string | null;
};

// ---------- Product recipes & booking snapshots ----------

export type ProductItem = {
  id: string;
  product_id: string;
  item_variant_id: string;
  quantity: number;
  // Part of the packet — booking seeding prices it at Rp 0 and the
  // snapshot on booking_items keeps invoices from repricing it.
  is_included: boolean;
  // Renders on the public product page's "Paket Termasuk" list.
  is_show_public: boolean;
};

export type RentalStatus = 'reserved' | 'checked_out' | 'returned';

export type BookingItem = {
  id: string;
  booking_id: string;
  item_variant_id: string;
  quantity: number;
  unit_price: number;
  // Snapshot of product_items.is_included at booking time: true means
  // the line is part of the package, so the final-invoice prefill
  // keeps the booking's unit_price (Rp 0) instead of repricing at the
  // live catalog price. False for pre-flag rows and add-on lines.
  is_included: boolean;
  // Frozen at creation from item_variants.cost_price; consumables
  // only — rentables carry no per-event material cost.
  unit_cost: number | null;
  rental_status: RentalStatus | null;
  checked_out_at: string | null;
  returned_at: string | null;
};

// ---------- Booking checklist ----------

export type ChecklistPhase = 'stock_check' | 'pickup' | 'return';

export type ChecklistStatus = 'pending' | 'in_stock' | 'need_order' | 'done';

export type ChecklistItem = {
  id: string;
  booking_id: string;
  booking_item_id: string | null;
  phase: ChecklistPhase;
  label: string;
  status: ChecklistStatus;
  note: string | null;
  completed_at: string | null;
  sort_order: number;
};

// ---------- Company settings (§8) ----------

export type CompanyProfile = {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  updated_at: string;
};

export type CompanyBankAccount = {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------- Invoices (§9) ----------

// A booking has several invoices over its life: first a deposit
// invoice, later the final one. At most one NON-VOID invoice of each
// type per booking (partial unique index).
export type InvoiceType = 'dp' | 'final';

// paid is derived from the ledger (balance due reaches zero); issued
// is frozen — correction means void + reissue.
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';

export type InvoiceLineSource = 'item' | 'vendor' | 'transport' | 'custom';

export type Invoice = {
  id: string;
  booking_id: string;
  invoice_type: InvoiceType;
  invoice_number: string | null;
  access_token: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  total: number;
  bank_account_id: string | null;
  company_name_snapshot: string | null;
  bank_account_snapshot: string | null;
  customer_name_snapshot: string | null;
  phone_snapshot: string | null;
  event_address_snapshot: string | null;
  event_date_snapshot: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Paid amount and balance due are NOT stored columns — they are
// calculated from ledger `in` rows (transactions.invoice_id) wherever
// an invoice is displayed or edited.

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  source_type: InvoiceLineSource;
  sort_order: number;
};

// ---------- Money ledger (§12) ----------

export type TransactionDirection = 'in' | 'out';

export type TransactionCategory = {
  id: string;
  name: string;
  direction: TransactionDirection;
  is_active: boolean;
  sort_order: number;
};

// Append-only: mistakes are fixed with a reversing row, never edits.
export type Transaction = {
  id: string;
  direction: TransactionDirection;
  // Always positive; the direction gives the sign.
  amount: number;
  transaction_date: string;
  category_id: string;
  account: string | null;
  description: string | null;
  booking_id: string | null;
  invoice_id: string | null;
  purchase_order_id: string | null;
  plan_line_id: string | null;
  staff_id: string | null;
  booking_staff_id: string | null;
  vendor_id: string | null;
  period_start: string | null;
  period_end: string | null;
  reverses_transaction_id: string | null;
  created_at: string;
};

// ---------- Staff & planned helper cost (§13) ----------

export type StaffMember = {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  // Informational only (e.g. "monthly", "weekly", "per event").
  pay_basis: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingStaffStatus = 'planned' | 'confirmed' | 'cancelled';

export type BookingStaff = {
  id: string;
  booking_id: string;
  staff_id: string;
  // The role on this event; null falls back to the staff member's own.
  role: string | null;
  // The pay agreed BEFORE the event — the expected helper cost.
  planned_pay: number;
  status: BookingStaffStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// ---------- Procurement (§11) ----------

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type PurchaseOrder = {
  id: string;
  supplier_id: string;
  booking_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  item_variant_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
};

// ---------- Purchase plans (§15) ----------

export type PlanType = 'buy' | 'create' | 'fix' | 'rnd' | 'upgrade';

export type PlanStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type PurchasePlan = {
  id: string;
  title: string;
  plan_type: PlanType;
  reason: string | null;
  booking_id: string | null;
  budget_estimate: number | null;
  target_date: string | null;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
};

export type PlanLineOutcome = 'testing' | 'adopted' | 'rejected';

export type PurchasePlanLine = {
  id: string;
  plan_id: string;
  item_variant_id: string | null;
  description: string;
  quantity: number;
  estimated_unit_cost: number | null;
  supplier_id: string | null;
  purchase_order_item_id: string | null;
  replaces_item_variant_id: string | null;
  done_at: string | null;
  outcome: PlanLineOutcome | null;
  outcome_note: string | null;
  sort_order: number;
};
