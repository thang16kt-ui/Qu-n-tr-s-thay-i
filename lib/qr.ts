/**
 * Mã QR duy nhất của thành viên:  MOC|<SĐT>|<mã đơn hoặc rỗng>|<2 ký tự kiểm tra>
 * Ví dụ: MOC|0901234567|A12|7K   hoặc   MOC|0901234567||Q3
 * 2 ký tự kiểm tra giúp nhân viên phát hiện mã bị gõ sai / sửa tay.
 */
const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // bỏ I, O cho dễ đọc

export function checksum(body: string): string {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const n = h % (ALPHABET.length * ALPHABET.length);
  return ALPHABET[Math.floor(n / ALPHABET.length)] + ALPHABET[n % ALPHABET.length];
}

export function buildQR(phone: string, orderCode?: string | null): string {
  const body = `MOC|${phone}|${orderCode ?? ""}`;
  return `${body}|${checksum(body)}`;
}

export type ParsedQR =
  | { ok: true; phone: string; orderCode: string | null }
  | { ok: false; error: string };

export function parseQR(raw: string): ParsedQR {
  const s = (raw || "").trim();
  const parts = s.split("|");
  if (parts.length !== 4 || parts[0] !== "MOC") return { ok: false, error: "Không phải mã Mộc Coffee" };
  const [, phone, code, sum] = parts;
  if (!/^0\d{9}$/.test(phone)) return { ok: false, error: "SĐT trong mã không hợp lệ" };
  if (checksum(`MOC|${phone}|${code}`) !== sum.toUpperCase()) return { ok: false, error: "Sai ký tự kiểm tra — mã bị lỗi" };
  return { ok: true, phone, orderCode: code || null };
}
