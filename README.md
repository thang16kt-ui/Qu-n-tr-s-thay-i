# Mộc Coffee — app tích điểm & đặt món (PWA)

Web app chạy trên điện thoại, mô phỏng app thành viên của quán **Mộc Coffee**.
Giao diện: **Next.js 16** chạy trên **Vercel**. Dữ liệu và logic: **Supabase** (Postgres, Realtime, pg_cron). Gửi thông báo: route `/api/notify` (web-push + VAPID).

- **Trang chủ**: thẻ thành viên (hạng, điểm, tiến độ lên hạng, nút Mã QR), chương trình nổi bật, ưu đãi của tôi, chuông thông báo.
- **Đặt món**: danh mục Cà phê / Trà / Đá xay / Bánh, tìm kiếm (gõ không dấu cũng được), size – đường – đá – topping – ghi chú, giỏ hàng, “Đặt món” (thanh toán tại quầy). Menu cập nhật realtime; món hết hàng tự xám lại.
- **QR**: MỘT mã duy nhất `MOC|<SĐT>|<mã đơn>|<2 ký tự kiểm tra>`. Có đơn → số đơn lớn, danh sách món, trạng thái realtime. Đơn xong → màn hình chuyển xanh + kêu “ting ting”. Đơn huỷ/hết hạn → “Đơn đã hết hạn, vui lòng đặt lại”.
- **Ưu đãi**: voucher của tôi / đổi ưu đãi bằng điểm. Trong **giỏ hàng** chọn 1 voucher, giá tự trừ (tính trong Supabase); đơn bị huỷ/hết hạn thì voucher được trả lại.
- **Cá nhân**: đổi tên, lịch sử điểm, lịch sử đơn, bật thông báo, hướng dẫn thêm vào màn hình chính, đăng xuất.
- **Quầy** `/pos` (tablet ngang): ô quét luôn sẵn sàng cho máy quét 2D USB/Bluetooth, **Quét bằng camera** (BarcodeDetector, dự phòng jsQR), **Nhập SĐT tay**.
  Quét `MOC|SĐT|mã đơn|ký tự kiểm tra` → mở đơn + thẻ thành viên (4 số cuối SĐT, điểm) → **Xác nhận & thu tiền** (tiền mặt/chuyển khoản) → cấp số đơn A01…, cộng điểm, in tem dán ly 50×30mm, đơn sang bếp.
  Mã chỉ có SĐT → **Tạo đơn tại quầy** hoặc **Chỉ tích điểm**. Cột phải: đơn hôm nay + trạng thái.
- **Bếp** `/kitchen`: thẻ đơn chữ lớn, đơn cũ bên trái, đồng hồ chờ (cam khi > 5 phút), chuông khi có đơn mới, **Bắt đầu pha** → **Xác nhận xong** (Hoàn tác 10 giây) → Web Push cho khách qua `/api/notify`. Cột “Đã xong” tự ẩn sau 10 phút.
- **Quản lý** `/admin`: thêm/sửa/xoá món, giá, ảnh, hết hàng (realtime sang app khách); **Giả lập khách đặt đơn**, **Đặt lại dữ liệu mẫu**; kiểm tra khoá VAPID.
- Cả 3 trang dùng chung **PIN nhân viên** (mặc định `1234`). Link cũ `/staff` tự chuyển sang `/pos`.

**Bản đang chạy:** https://moc-coffee-app.onrender.com · quầy `/pos` · bếp `/kitchen` · quản lý `/admin` (PIN `1234`)

👉 **Đưa lên mạng: xem [HUONG-DAN-TRIEN-KHAI.md](HUONG-DAN-TRIEN-KHAI.md)** (Render hoặc Vercel + Supabase, từng bước, cho người không biết lập trình).

## Kiến trúc

```
Điện thoại khách · Tablet quầy / bếp / quản lý
   │  Next.js trên Render Web Service (HTTPS) — chạy được cả trên Vercel
   │      └─ /api/notify ── web-push + VAPID (biến môi trường) ──▶ Web Push tới điện thoại khách
   ▼
Supabase
 ├─ Bảng: members, menu_items, orders, point_log, vouchers, member_vouchers   (chỉ cho ĐỌC)
 ├─ Hàm RPC (ghi dữ liệu): member_login, place_order, redeem_voucher, staff_* (kiểm tra PIN)
 ├─ Realtime: menu_items, orders, members
 ├─ pg_cron: mỗi phút huỷ đơn "pending" quá 30 phút
 └─ private.settings: mã PIN nhân viên   (không mở ra ngoài)
```

- Giá món được **tính lại trong database** (`place_order`, `staff_create_order`), không tin giá từ trình duyệt.
- **Mỗi đơn chỉ xác nhận & cộng điểm 1 lần**: `staff_confirm` khoá dòng đơn, chỉ nhận đơn `pending`; quét lại báo “Đơn đã được xác nhận”.

## File database
| File | Khi nào chạy |
|---|---|
| `supabase/schema.sql` | Project mới: chạy đầu tiên |
| `supabase/pos.sql` | Sau schema.sql (và khi nâng cấp từ bản cũ). Lần đầu: PIN = 1234, thêm đơn mẫu |
| `supabase/seed.sql` | Không bắt buộc — đưa thực đơn/ưu đãi về mặc định |
| `supabase/settings.example.sql` | Đổi PIN nhân viên |

Chạy thử trên máy: `npm install`, tạo `.env.local` từ `.env.example`, rồi `npm run dev` → http://localhost:3000 (camera chạy được trên `localhost`).

## Thông báo trên iPhone
iPhone chỉ nhận Web Push khi app được **thêm vào màn hình chính** (iOS 16.4 trở lên):
Safari → nút **Chia sẻ** → **Thêm vào MH chính** → mở Mộc từ biểu tượng → **Bật thông báo**.
App có sẵn hướng dẫn này ở tab QR và Cá nhân. Máy không nhận được push thì màn QR tự chuyển xanh + kêu khi đơn xong.

## Quy tắc trong app
| Quy tắc | Giá trị | Sửa ở đâu |
|---|---|---|
| Tích điểm | 10.000đ = 1 điểm, cộng đúng 1 lần khi quầy bấm “Xác nhận & thu tiền” (ghi `point_log`); huỷ đơn thì trừ lại | `staff_confirm`, `staff_cancel` trong `pos.sql` + `lib/tiers.ts` |
| Hạng (theo điểm tích luỹ) | Mầm 0 · Chồi 50 · Cây 150 · Cổ thụ 400 | hàm `tier_for` + `lib/tiers.ts` |
| Đơn hết hạn | `pending` quá 30 phút → `cancelled` (pg_cron mỗi phút) | `private.expire_stale` + `pos.sql` + `lib/orders.ts` |
| Số đơn | A01…A99, B01… theo giờ xác nhận tại quầy, đánh lại mỗi ngày (giờ VN) | `private.next_queue_code` |
| Hàng chờ công bằng | Đặt món trên app chỉ tạo **mã tạm**; đơn chỉ vào hàng chờ, có **số đơn** và hiện ở bếp khi quầy xác nhận — ai đến trước làm trước | `place_order`, `staff_confirm` |
| Mỗi khách | chỉ 1 đơn đang chờ (vì chỉ có 1 mã QR) | `place_order` |
| Voucher | loại `percent`, `upsize`, `topping`, `item_amount`, `free_item`, `bogo` (cột `kind`, `value`, `item_ids` của bảng vouchers) | `private.voucher_discount` |

**Thêm/sửa món**: trang `/admin` → Thực đơn. Ảnh tải lên được thu nhỏ (≤480px) và lưu thẳng vào cột `image`; ảnh mặc định ở `public/menu/` (tự vẽ, SVG).
**Đổi PIN nhân viên**: `update private.settings set value = '5678' where key = 'staff_pin';`

## Lưu ý: đây là bản mô phỏng
- **Không có mật khẩu**: ai biết SĐT đều vào được tài khoản đó, và dữ liệu đọc được công khai qua publishable key. Dùng thật cần thêm OTP (Supabase Auth) và siết quyền đọc.
- Supabase Security Advisor sẽ cảnh báo các hàm RPC gọi được không cần đăng nhập — đó là chủ ý của bản demo (mỗi hàm tự kiểm tra dữ liệu/PIN).
- PIN nhân viên 4 số dùng chung cho mọi tablet. Dùng thật cần PIN dài hơn / tài khoản riêng cho từng nhân viên.
- Không có cổng thanh toán — khách trả tiền tại quầy.
- Logo, ảnh món và tên “Mộc Coffee” đều tự thiết kế cho bản demo.
