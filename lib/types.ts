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
  product_id: string;
  customer_name: string;
  phone: string;
  event_date: string;
  event_address: string;
  theme: string | null;
  message: string | null;
  status: BookingStatus;
  project_status: ProjectStatus;
  dp_received_at: string | null;
};

// ---------- Item master data ----------

export type ItemType = 'consumable' | 'rentable';

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
};

export type RentalStatus = 'reserved' | 'checked_out' | 'returned';

export type BookingItem = {
  id: string;
  booking_id: string;
  item_variant_id: string;
  quantity: number;
  unit_price: number;
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
