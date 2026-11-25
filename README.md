# Mộc Coffee — app tích điểm & đặt món (PWA)

Web app chạy trên điện thoại, mô phỏng app thành viên của quán **Mộc Coffee**.
Giao diện: **Next.js 16** xuất ra trang tĩnh. Toàn bộ dữ liệu và logic: **Supabase** (Postgres, Realtime, Edge Function).

- **Trang chủ**: thẻ thành viên (hạng, điểm, tiến độ lên hạng, nút Mã QR), chương trình nổi bật, ưu đãi của tôi, chuông thông báo.
- **Đặt món**: danh mục Cà phê / Trà / Đá xay / Bánh, tìm kiếm (gõ không dấu cũng được), size – đường – đá – topping – ghi chú, giỏ hàng, “Đặt món” (thanh toán tại quầy). Menu cập nhật realtime; món hết hàng tự xám lại.
- **QR**: MỘT mã duy nhất `MOC|<SĐT>|<mã đơn>|<2 ký tự kiểm tra>`. Có đơn → số đơn lớn, danh sách món, trạng thái realtime. Đơn xong → màn hình chuyển xanh + kêu “ting ting”. Đơn huỷ/hết hạn → “Đơn đã hết hạn, vui lòng đặt lại”.
- **Ưu đãi**: voucher của tôi / đổi ưu đãi bằng điểm.
- **Cá nhân**: đổi tên, lịch sử điểm, lịch sử đơn, bật thông báo, hướng dẫn thêm vào màn hình chính, đăng xuất.
- **Trang nhân viên** `/staff` (có PIN): quét QR bằng camera, xác nhận đơn (tự cộng điểm) → đang pha → đã xong (tự gửi thông báo), tích điểm cho hoá đơn tại quầy, bật/tắt món hết hàng.

## Kiến trúc

```
Điện thoại khách / nhân viên
   │  trang tĩnh (GitHub Pages)
   ▼
Supabase
 ├─ Bảng: members, menu_items, orders, point_log, vouchers, member_vouchers   (chỉ cho ĐỌC)
 ├─ Hàm RPC (ghi dữ liệu): member_login, place_order, redeem_voucher, staff_* …
 ├─ Realtime: menu_items, orders, members
 ├─ private.settings: mã PIN nhân viên, khoá VAPID   (không mở ra ngoài)
 └─ Trigger orders_done_push ──pg_net──▶ Edge Function send-push ──▶ Web Push tới điện thoại
```

- Giá món được **tính lại trong database** (`place_order`), không tin giá từ trình duyệt.
- Mọi hàm nhân viên đều kiểm tra **mã PIN** lưu trong `private.settings`.

---

## Cài từ đầu (nếu muốn dựng lại ở project Supabase khác)

1. Tạo project Supabase → **SQL Editor**, chạy lần lượt:
   `supabase/schema.sql` → `supabase/seed.sql` → `supabase/settings.example.sql` (điền PIN, khoá VAPID, link Edge Function).
   Khoá VAPID tạo bằng `npm install && npm run vapid`.
2. **Edge Functions → Deploy a new function → Via Editor**, tên `send-push`, dán nội dung `supabase/functions/send-push/index.ts`
   (sửa `APP_VAPID_PUBLIC_KEY` thành Public Key của bạn), **tắt “Verify JWT”**.
3. Sửa `.env.production`: URL project, publishable key, VAPID public key.
4. Đẩy code lên GitHub → **Settings → Pages → Source: GitHub Actions**. Workflow `.github/workflows/deploy.yml` sẽ tự build và đưa lên
   `https://<tài-khoản>.github.io/<tên-repo>/`.

Chạy thử trên máy: `npm install && npm run dev` → http://localhost:3000

## Thông báo trên iPhone
iPhone chỉ nhận Web Push khi app được **thêm vào màn hình chính** (iOS 16.4 trở lên):
Safari → nút **Chia sẻ** → **Thêm vào MH chính** → mở Mộc từ biểu tượng → **Bật thông báo**.
App có sẵn hướng dẫn này ở tab QR và Cá nhân. Máy không nhận được push thì màn QR tự chuyển xanh + kêu khi đơn xong.

## Quy tắc trong app
| Quy tắc | Giá trị | Sửa ở đâu |
|---|---|---|
| Tích điểm | 10.000đ = 1 điểm, cộng khi nhân viên xác nhận đơn | `staff_set_status` trong `schema.sql` + `lib/tiers.ts` |
| Hạng (theo điểm tích luỹ) | Mầm 0 · Chồi 50 · Cây 150 · Cổ thụ 400 | hàm `tier_for` + `lib/tiers.ts` |
| Đơn hết hạn | 30 phút chưa được quét | `private.expire_stale` + `lib/orders.ts` |
| Số đơn | A1…A99, B1… đánh lại mỗi ngày (giờ VN) | `place_order` |
| Mỗi khách | chỉ 1 đơn đang chờ (vì chỉ có 1 mã QR) | `place_order` |

**Thêm/sửa món**: Supabase → **Table Editor → menu_items**. Ảnh món ở `public/menu/` (tự vẽ, SVG); có thể thay bằng link ảnh thật trong cột `image`.
**Đổi PIN nhân viên**: `update private.settings set value = '123456' where key = 'staff_pin';`

## Lưu ý: đây là bản mô phỏng
- **Không có mật khẩu**: ai biết SĐT đều vào được tài khoản đó, và dữ liệu đọc được công khai qua publishable key. Dùng thật cần thêm OTP (Supabase Auth) và siết quyền đọc.
- Supabase Security Advisor sẽ cảnh báo các hàm RPC gọi được không cần đăng nhập — đó là chủ ý của bản demo (mỗi hàm tự kiểm tra dữ liệu/PIN).
- Không có cổng thanh toán — khách trả tiền tại quầy.
- Logo, ảnh món và tên “Mộc Coffee” đều tự thiết kế cho bản demo.
