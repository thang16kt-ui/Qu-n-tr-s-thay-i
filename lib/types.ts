export type Category = "Cà phê" | "Trà" | "Đá xay" | "Bánh";
export const CATEGORIES: Category[] = ["Cà phê", "Trà", "Đá xay", "Bánh"];

export type PricedOption = { name: string; price: number };

export type MenuOptions = {
  sizes?: PricedOption[];
  sugar?: string[];
  ice?: string[];
  toppings?: PricedOption[];
};

export type MenuItem = {
  id: string;
  category: Category;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  available: boolean;
  options: MenuOptions;
  sort: number;
};

export type Member = {
  phone: string;
  name: string | null;
  points: number;
  tier: string;
  created_at: string;
};

/** Lựa chọn của khách cho 1 món */
export type Selection = {
  size?: string;
  sugar?: string;
  ice?: string;
  toppings: string[];
  note?: string;
};

/** Một dòng trong đơn (lưu vào orders.items) */
export type OrderLine = Selection & {
  itemId: string;
  name: string;
  image?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderStatus = "pending" | "confirmed" | "making" | "done" | "cancelled";

export type Order = {
  id: string;
  /** Số thứ tự (A1, A2…) — chỉ có sau khi nhân viên quét mã tại quầy */
  code: string | null;
  /** Mã tạm 4 ký tự in trong QR trước khi đến quầy */
  ref?: string | null;
  member_phone: string;
  items: OrderLine[];
  subtotal?: number | null;
  discount?: number;
  voucher_title?: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  confirmed_at: string | null;
  done_at: string | null;
  /** Thời điểm huỷ: lúc hết hạn (đặt + 30 phút), lúc khách huỷ hoặc lúc quầy huỷ */
  cancelled_at?: string | null;
  cancel_reason?: "expired" | "customer" | "staff" | null;
  payment_method?: "cash" | "transfer" | null;
  paid_at?: string | null;
  source?: "app" | "counter" | "demo" | null;
};

export type PointLog = {
  id: number;
  member_phone: string;
  order_id: string | null;
  points: number;
  note: string | null;
  created_at: string;
};

export type Voucher = {
  id: string;
  title: string;
  description: string | null;
  cost_points: number;
  color: string | null;
  valid_days: number;
  active: boolean;
};

export type MemberVoucher = {
  id: string;
  member_phone: string;
  voucher_id: string;
  code: string;
  used: boolean;
  created_at: string;
  expires_at: string;
  vouchers?: Voucher | null;
};
