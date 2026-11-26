import { redirect } from "next/navigation";

// Màn hình Cn đã chuyển vào app tích điểm: Tôi → "Dành cho nhân viên" (/staff)
export default function KitchenPage() {
  redirect("/staff/");
}
