# Mộc Coffee — app tích điểm & đặt món (PWA)

Web app chạy trên điện thoại, mô phỏng app thành viên của quán **Mộc Coffee**.
Làm bằng **Next.js 16** + **Supabase** (Postgres + Realtime). Giao diện tiếng Việt, tông nâu kem.

- **Trang chủ**: thẻ thành viên (hạng, điểm, tiến độ lên hạng), chương trình nổi bật, ưu đãi của tôi, chuông thông báo.
- **Đặt món**: danh mục Cà phê / Trà / Đá xay / Bánh, tìm kiếm (gõ không dấu cũng được), chọn size – đường – đá – topping – ghi chú, giỏ hàng, “Đặt món” (thanh toán tại quầy). Menu cập nhật realtime; món hết hàng tự xám lại.
- **QR**: MỘT mã duy nhất `MOC|<SĐT>|<mã đơn>|<2 ký tự kiểm tra>`. Có đơn → hiện số đơn lớn, danh sách món, trạng thái realtime. Đơn xong → màn hình chuyển xanh + kêu “ting ting”. Đơn huỷ/hết hạn → “Đơn đã hết hạn, vui lòng đặt lại”.
- **Ưu đãi**: voucher của tôi / đổi ưu đãi bằng điểm.
- **Cá nhân**: đổi tên, lịch sử điểm, lịch sử đơn, bật thông báo, hướng dẫn thêm vào màn hình chính, đăng xuất.
- **Trang nhân viên** `/staff` (có PIN): quét QR bằng camera, xác nhận đơn (tự cộng điểm) → đang pha → đã xong (tự gửi thông báo), tích điểm cho hoá đơn tại quầy, bật/tắt món hết hàng.

---

## Cài đặt từng bước

### 1. Chuẩn bị
- Cài **Node.js 20** trở lên: https://nodejs.org (chọn bản LTS).
- Tạo tài khoản miễn phí tại https://supabase.com và bấm **New project**.

### 2. Tạo database
1. Trong Supabase, mở **SQL Editor** → **New query**.
2. Mở file `supabase/schema.sql`, sao chép toàn bộ, dán vào, bấm **Run**.
3. Làm tương tự với `supabase/seed.sql` (15 món, 6 ưu đãi mẫu, 1 thành viên mẫu `0900000000`).

### 3. Lấy khoá Supabase
Vào **Project Settings → API Keys** (hoặc **Data API**):
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (giữ bí mật, không chia sẻ)

### 4. Cấu hình app
Mở Terminal trong thư mục dự án:

```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run vapid                   # in ra 2 khoá Public Key / Private Key cho thông báo
```

Mở `.env.local` và điền: 3 khoá Supabase ở bước 3, 2 khoá VAPID vừa in ra
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), và đổi `STAFF_PIN` nếu muốn.

### 5. Chạy thử trên máy tính
```bash
npm run dev
```
Mở http://localhost:3000 → đăng nhập bằng số bất kỳ (vd `0901234567`).
Mở thêm tab http://localhost:3000/staff (PIN mặc định `1234`) để đóng vai nhân viên.

> Mẹo: trong Chrome bấm F12 → biểu tượng điện thoại để xem giao diện mobile.

### 6. Đưa lên mạng để dùng trên điện thoại
Thông báo đẩy và camera **chỉ chạy trên HTTPS**, nên cần deploy. Cách dễ nhất là **Vercel**:
1. Đưa thư mục này lên GitHub.
2. Vào https://vercel.com → **Add New → Project** → chọn repo.
3. Ở mục **Environment Variables**, thêm đủ các biến trong `.env.local`.
4. Bấm **Deploy**. Xong sẽ có link dạng `https://moc-coffee.vercel.app`.

(Render cũng được: tạo **Web Service**, Build command `npm install && npm run build`, Start command `npm start`, thêm các biến môi trường.)

---

## Kịch bản demo (2 điện thoại)
1. **Máy khách** mở link → đăng nhập bằng SĐT → nhận voucher chào mừng.
2. Tab **Đặt món** → chọn món, tuỳ chỉnh → **Đặt món** → app tự chuyển sang tab **QR** với số đơn `#A1`, trạng thái *Chờ xác nhận*. Bấm **Bật** để nhận thông báo.
3. **Máy nhân viên** mở `/staff` → **Quét mã QR của khách** → **Xác nhận & tích điểm** (máy khách thấy điểm tăng ngay) → **Bắt đầu pha** → **Đã xong ✓**.
4. Máy khách nhận thông báo *“Đơn #A1 đã xong, mời bạn ra quầy nhận”*. Nếu máy không hỗ trợ thông báo, màn hình QR tự chuyển **xanh** và kêu.
5. Thử tab **Thực đơn** ở máy nhân viên: tắt một món → máy khách thấy món đó xám lại ngay.

## Thông báo trên iPhone
iPhone chỉ nhận Web Push khi app được **thêm vào màn hình chính** (iOS 16.4 trở lên):
Safari → nút **Chia sẻ** → **Thêm vào MH chính** → mở Mộc từ biểu tượng → **Bật thông báo**.
App đã có sẵn hướng dẫn này ở tab QR và Cá nhân.

---

## Quy tắc trong app
| Quy tắc | Giá trị | Sửa ở đâu |
|---|---|---|
| Tích điểm | 10.000đ = 1 điểm, cộng khi nhân viên xác nhận đơn | `lib/tiers.ts` |
| Hạng (theo điểm tích luỹ) | Mầm 0 · Chồi 50 · Cây 150 · Cổ thụ 400 | `lib/tiers.ts` + hàm `tier_for` trong `schema.sql` |
| Đơn hết hạn | 30 phút chưa được quét | `lib/orders.ts` |
| Số đơn | A1…A99, B1… đánh lại mỗi ngày | `lib/orders.ts` |
| Mỗi khách | chỉ 1 đơn đang chờ (vì chỉ có 1 mã QR) | `app/api/orders/route.ts` |

**Mã QR**: `MOC|0901234567|A12|7K`. Hai ký tự cuối là mã kiểm tra (hàm băm FNV-1a), giúp phát hiện mã bị gõ sai hoặc sửa tay. Dưới mã QR có in sẵn SĐT · số đơn · mã kiểm tra để nhân viên gõ tay nếu camera không quét được.

**Thêm/sửa món**: vào Supabase → **Table Editor → menu_items**. Ảnh món nằm ở `public/menu/` (ảnh minh hoạ tự vẽ dạng SVG). Có thể thay bằng link ảnh thật trong cột `image`.

## Cấu trúc thư mục
```
app/(tabs)/home|order|qr|offers|me   5 tab của khách
app/login                            đăng nhập bằng SĐT
app/staff                            màn hình nhân viên
app/api/...                          API (ghi dữ liệu bằng service key, gửi push)
components/                          giao diện dùng chung
lib/                                 logic: mã QR, giá, hạng, đơn, push, giỏ hàng
public/sw.js                         service worker nhận thông báo
public/menu/, public/icons/          ảnh món, logo/icon app
supabase/schema.sql, seed.sql        database
```

## Lưu ý: đây là bản mô phỏng
- **Không có mật khẩu**: ai biết SĐT đều đăng nhập được tài khoản đó, và dữ liệu đọc được công khai qua anon key. Để dùng thật cần thêm xác thực OTP (Supabase Auth) và siết lại quyền đọc (RLS).
- Trình duyệt chỉ được **đọc**; mọi thao tác ghi (đặt món, cộng điểm, đổi quà) đi qua API của app dùng service key ở server.
- Không có cổng thanh toán — khách trả tiền tại quầy.
- Logo, ảnh món và tên “Mộc Coffee” đều tự thiết kế cho bản demo.
