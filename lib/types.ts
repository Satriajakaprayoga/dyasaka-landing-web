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
};
