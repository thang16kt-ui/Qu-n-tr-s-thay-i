"use client";
// Mọi thao tác GHI đều gọi hàm trong Supabase (RPC) — xem supabase/schema.sql
import { sb } from "./supabase";
import type { Member, MemberVoucher, MenuItem, Order } from "./types";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message || "Có lỗi, vui lòng thử lại");
  return data as T;
}

/** Voucher của khách + số tiền giảm cho giỏ hàng hiện tại (tính trong Supabase) */
export type VoucherOption = {
  id: string; code: string; expires_at: string; title: string; description: string | null;
  color: string | null; discount: number; reason: string | null;
};

export type OrderInput = { itemId: string; qty: number; size?: string; sugar?: string; ice?: string; toppings: string[]; note?: string };

export const api = {
  login: (phone: string) => rpc<Member>("member_login", { p_phone: phone }),
  setName: (phone: string, name: string) => rpc<Member>("member_set_name", { p_phone: phone, p_name: name }),
  placeOrder: (phone: string, items: OrderInput[], sub: PushSubscriptionJSON | null, voucherId: string | null) =>
    rpc<Order>("place_order", { p_phone: phone, p_items: items, p_sub: sub, p_voucher: voucherId }),
  previewVouchers: (phone: string, items: OrderInput[]) =>
    rpc<VoucherOption[]>("preview_vouchers", { p_phone: phone, p_items: items }),
  attachPush: (phone: string, orderId: string, sub: PushSubscriptionJSON) =>
    rpc<boolean>("attach_push", { p_phone: phone, p_order: orderId, p_sub: sub }),
  cancelOrder: (phone: string, orderId: string) => rpc<boolean>("cancel_order", { p_phone: phone, p_order: orderId }),
  redeem: (phone: string, voucherId: string) => rpc<MemberVoucher>("redeem_voucher", { p_phone: phone, p_voucher: voucherId }),
};

export type ScanResult = { member: Member; order: Order | null; pendingOrder?: Order | null; orderCode: string | null };
export type StatusResult = { order: Order; points: number; hadSubscription: boolean };
export type ConfirmResult = { order: Order; points: number; member: Member | null };
export type NotifyResult = { ok: boolean; sent: boolean; reason?: string };

export const staffApi = (pin: string) => ({
  check: () => rpc<boolean>("staff_check", { p_pin: pin }),
  scan: (phone: string, code: string | null) => rpc<ScanResult>("staff_scan", { p_pin: pin, p_phone: phone, p_code: code }),
  setStatus: (orderId: string, status: string) => rpc<StatusResult>("staff_set_status", { p_pin: pin, p_order: orderId, p_status: status }),
  addPoints: (phone: string, amount: number) => rpc<{ member: Member; points: number }>("staff_add_points", { p_pin: pin, p_phone: phone, p_amount: amount }),
  setAvailable: (id: string, available: boolean) => rpc<MenuItem>("staff_set_available", { p_pin: pin, p_id: id, p_available: available }),
  /** items: món đã sửa ở quầy — chỉ được ghi vào đơn (và app khách đổi theo) lúc xác nhận */
  confirm: (orderId: string, method: "cash" | "transfer", items?: OrderInput[]) =>
    rpc<ConfirmResult>("staff_confirm", { p_pin: pin, p_order: orderId, p_method: method, ...(items ? { p_items: items } : {}) }),
  cancel: (orderId: string) => rpc<{ order: Order; points: number }>("staff_cancel", { p_pin: pin, p_order: orderId }),
  createOrder: (phone: string, items: OrderInput[]) => rpc<Order>("staff_create_order", { p_pin: pin, p_phone: phone, p_items: items }),
  /** Bán tại quầy: tạo + thu tiền + xác nhận một lần. phone = null → khách vãng lai */
  sell: (phone: string | null, items: OrderInput[], method: "cash" | "transfer") =>
    rpc<ConfirmResult>("staff_sell", { p_pin: pin, p_phone: phone, p_items: items, p_method: method }),
  /** Xem trước đơn sau khi thêm/bớt món — CHƯA lưu, app khách chưa đổi */
  previewOrder: (orderId: string, items: OrderInput[]) => rpc<Order>("staff_preview_order", { p_pin: pin, p_order: orderId, p_items: items }),
  saveMenuItem: (item: Partial<MenuItem>) => rpc<MenuItem>("staff_save_menu_item", { p_pin: pin, p_item: item }),
  deleteMenuItem: (id: string) => rpc<boolean>("staff_delete_menu_item", { p_pin: pin, p_id: id }),
  resetDemo: () => rpc<{ ok: boolean; orders: number; members: number }>("staff_reset_demo", { p_pin: pin }),
  simulateOrder: () => rpc<Order>("staff_simulate_order", { p_pin: pin }),
  /** Gửi Web Push "Đơn #A12 đã xong…" qua route /api/notify (chạy trên Vercel) */
  notify: async (orderId: string): Promise<NotifyResult> => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/notify/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, orderId }),
      });
      return (await r.json()) as NotifyResult;
    } catch {
      return { ok: false, sent: false, reason: "Không gọi được /api/notify" };
    }
  },
});
export type StaffApi = ReturnType<typeof staffApi>;

/** Đường dẫn file tĩnh (ảnh, icon…) có tính basePath khi deploy dưới thư mục con, vd GitHub Pages */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const asset = (p?: string | null) => (p && p.startsWith("/") ? BASE + p : p || BASE + "/logo-mark.svg");
