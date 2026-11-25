export type TierInfo = { name: string; min: number; from: string; to: string; perk: string };

/** Hạng tính theo tổng điểm đã tích luỹ (khớp với hàm tier_for trong schema.sql) */
export const TIERS: TierInfo[] = [
  { name: "Mầm", min: 0, from: "#A8D5B5", to: "#6FB58C", perk: "Tích 1 điểm cho mỗi 10.000đ" },
  { name: "Chồi", min: 50, from: "#6FB58C", to: "#2F8F5B", perk: "Tặng 1 topping mỗi tháng" },
  { name: "Cây", min: 150, from: "#2F8F5B", to: "#1F6B44", perk: "Miễn phí nâng size ngày sinh nhật" },
  { name: "Cổ thụ", min: 400, from: "#1F3A2B", to: "#14261C", perk: "Ưu tiên pha chế + quà riêng" },
];

/** 10.000đ = 1 điểm */
export const VND_PER_POINT = 10000;
export const pointsFor = (amount: number) => Math.floor(amount / VND_PER_POINT);

export function tierInfo(name: string): TierInfo {
  return TIERS.find((t) => t.name === name) ?? TIERS[0];
}

export function nextTier(earned: number): { next: TierInfo | null; remaining: number; progress: number } {
  const idx = [...TIERS].reverse().find((t) => earned >= t.min);
  const cur = idx ?? TIERS[0];
  const i = TIERS.indexOf(cur);
  const next = TIERS[i + 1] ?? null;
  if (!next) return { next: null, remaining: 0, progress: 1 };
  return {
    next,
    remaining: next.min - earned,
    progress: (earned - cur.min) / (next.min - cur.min),
  };
}
