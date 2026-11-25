export function vnd(n: number): string {
  return n.toLocaleString("vi-VN") + "đ";
}

/** Chuẩn hoá SĐT Việt Nam: bỏ khoảng trắng, +84 → 0. Trả về null nếu không hợp lệ. */
export function normalizePhone(input: string): string | null {
  let p = (input || "").replace(/[\s.\-()]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length === 11) p = "0" + p.slice(2);
  return /^0\d{9}$/.test(p) ? p : null;
}

export function prettyPhone(p: string): string {
  return p.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} ngày trước`;
  return dateShort(iso);
}

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
}
