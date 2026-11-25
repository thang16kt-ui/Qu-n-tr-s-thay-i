import { redirect } from "next/navigation";

// Màn hình nhân viên cũ đã được thay bằng POS tại quầy
export default function StaffPage() {
  redirect("/pos/");
}
