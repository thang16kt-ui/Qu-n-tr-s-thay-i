# Hướng dẫn đưa Mộc Coffee lên mạng (Vercel + Supabase)

Dành cho người **không biết lập trình**. Làm lần lượt từ Bước 1 đến Bước 7, khoảng 30–40 phút.
Kết quả: một đường link dạng `https://moc-coffee.vercel.app` (có sẵn HTTPS) mở được trên điện thoại và tablet:

| Trang | Dùng cho | Thiết bị |
|---|---|---|
| `/` | App khách: tích điểm, đặt món, mã QR | Điện thoại khách |
| `/pos` | Quầy thu ngân: quét mã, thu tiền, in tem | Tablet ngang + máy quét 2D |
| `/kitchen` | Màn hình bếp / pha chế | Tablet ngang |
| `/admin` | Quản lý thực đơn, chế độ demo | Tablet hoặc máy tính |

> **Vì sao phải có HTTPS?** Trình duyệt chỉ cho mở **camera** (quét mã) và gửi **thông báo đẩy (Web Push)** trên trang HTTPS.
> Vercel tự cấp HTTPS miễn phí, bạn không phải làm gì thêm.

Bạn cần: một tài khoản **GitHub**, một tài khoản **Supabase** (đã có từ bản trước), và một email để đăng ký **Vercel**.

---

## Bước 1 — Cập nhật code lên GitHub

Nếu Claude đã đẩy code thẳng lên kho `Qu-n-tr-s-thay-i` thì bỏ qua bước này.
Nếu bạn nhận được file **moc-coffee.zip**:

1. Giải nén file zip trên máy tính → được thư mục `moc-coffee`.
2. Mở https://github.com → vào kho **Qu-n-tr-s-thay-i**.
3. Bấm **Add file → Upload files**.
4. Mở thư mục `moc-coffee`, chọn **tất cả** file và thư mục bên trong (Ctrl+A / Cmd+A) rồi **kéo thả** vào trang GitHub.
   (Kéo nội dung bên trong, không kéo cả thư mục `moc-coffee`.)
5. Chờ GitHub tải lên xong, ô *Commit changes* ghi: `Thêm POS, bếp, quản lý` → bấm **Commit changes**.

Kiểm tra: trong kho phải thấy các thư mục `app/pos`, `app/kitchen`, `app/admin` và file `supabase/pos.sql`.

---

## Bước 2 — Cập nhật database Supabase

1. Mở https://supabase.com/dashboard → chọn project của Mộc Coffee.
2. Menu trái → **SQL Editor** → **New query**.
3. Trên GitHub, mở file `supabase/pos.sql` → bấm nút **Copy raw file** (biểu tượng 2 tờ giấy) → dán vào SQL Editor.
4. Bấm **Run**. Thấy *Success. No rows returned* là xong.

File này sẽ:
- thêm các hàm cho quầy / bếp / quản lý,
- đặt **mã PIN nhân viên = 1234** (cho cả 3 trang),
- bật tự động **huỷ đơn “chờ” quá 30 phút** (chạy mỗi phút),
- tạo **6 thành viên mẫu + 7 đơn mẫu** hôm nay để demo.

Chạy lại file này nhiều lần cũng không sao (không tạo trùng, không đổi lại PIN).

<details>
<summary>Làm project Supabase MỚI hoàn toàn (không bắt buộc)</summary>

1. https://supabase.com/dashboard → **New project**, đặt tên, chọn vùng **Southeast Asia (Singapore)**, đặt mật khẩu database → **Create**.
2. SQL Editor: chạy `supabase/schema.sql` trước, rồi `supabase/pos.sql`.
3. Ở Bước 4 dùng URL và khoá của project mới.
</details>

---

## Bước 3 — Lấy khoá VAPID (để gửi thông báo “Đơn đã xong”)

VAPID là **một cặp khoá**: *khoá công khai* (Public Key) và *khoá bí mật* (Private Key). Hai khoá phải đi cùng nhau.

### Cách A — Dùng lại khoá cũ (nên chọn, vì app đã chạy trước đây)
Khách đã bật thông báo sẽ **không phải bật lại**.

1. Supabase → **SQL Editor** → **New query**, dán dòng sau rồi **Run**:
   ```sql
   select key, value from private.settings where key in ('vapid_public', 'vapid_private', 'vapid_subject');
   ```
2. Ghi lại 3 giá trị:
   - `vapid_public` → dùng cho **NEXT_PUBLIC_VAPID_PUBLIC_KEY**
   - `vapid_private` → dùng cho **VAPID_PRIVATE_KEY** ⚠️ bí mật, không gửi cho ai, không dán lên GitHub
   - `vapid_subject` → dùng cho **VAPID_SUBJECT** (dạng `mailto:email@...`)

### Cách B — Tạo cặp khoá mới (nếu không có khoá cũ)
Chọn 1 trong 2:
- **Không cần cài gì:** làm tiếp Bước 4–5 trước (bỏ trống 2 biến VAPID), sau khi web chạy thì mở
  `https://<link của bạn>/admin` → PIN `1234` → **Thông báo đẩy** → **Tạo khoá** → bấm **Chép** từng khoá.
  Khoá được tạo ngay trên máy bạn, không gửi đi đâu. Sau đó quay lại Bước 6 để điền.
- **Có cài Node.js:** mở Terminal, gõ `npx web-push generate-vapid-keys` → máy in ra *Public Key* và *Private Key*.

`VAPID_SUBJECT` là email của bạn, viết dạng `mailto:tenban@gmail.com`.

---

## Bước 4 — Lấy địa chỉ và khoá công khai của Supabase

Supabase → **Project Settings** (bánh răng) → **API Keys** (hoặc **Data API**):
- **Project URL**: dạng `https://abcdxyz.supabase.co` → dùng cho **NEXT_PUBLIC_SUPABASE_URL**
- **Publishable key**: bắt đầu bằng `sb_publishable_...` (bản cũ gọi là *anon public*) → dùng cho **NEXT_PUBLIC_SUPABASE_ANON_KEY**

> ⚠️ **Không** dùng khoá *secret* / *service_role*. App không cần khoá đó.

---

## Bước 5 — Đưa web lên Vercel

1. Mở https://vercel.com → **Sign Up** → chọn **Continue with GitHub** → cho phép Vercel truy cập GitHub.
   (Gói **Hobby** miễn phí là đủ.)
2. Bấm **Add New… → Project**.
3. Ở danh sách kho GitHub, cạnh **Qu-n-tr-s-thay-i** bấm **Import**.
   Không thấy kho? Bấm **Adjust GitHub App Permissions** → cho phép kho này.
4. Màn hình *Configure Project*:
   - **Project Name**: `moc-coffee` (sẽ thành link `moc-coffee.vercel.app`; nếu trùng, Vercel thêm đuôi).
   - **Framework Preset**: **Next.js** (Vercel tự nhận ra, không cần sửa).
   - **Build and Output Settings**: để mặc định.
   - Mở mục **Environment Variables**, thêm lần lượt 5 dòng ở bảng dưới (ô *Key* bên trái, *Value* bên phải, bấm **Add** sau mỗi dòng).
5. Bấm **Deploy**. Chờ 1–2 phút đến khi thấy pháo hoa 🎉 → bấm **Continue to Dashboard**.
6. Link web nằm ở mục **Domains**, dạng `https://moc-coffee.vercel.app`.

### Các biến môi trường cần điền

| Key (gõ y hệt) | Value lấy ở đâu | Bí mật? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Bước 4) | Không |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key `sb_publishable_...` (Bước 4) | Không |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Khoá VAPID **công khai** (Bước 3) | Không |
| `VAPID_PRIVATE_KEY` | Khoá VAPID **bí mật** (Bước 3) | **Có** — chỉ dán vào Vercel |
| `VAPID_SUBJECT` | `mailto:email-cua-ban@gmail.com` | Không |

Lưu ý:
- Không có khoảng trắng / xuống dòng thừa ở đầu hoặc cuối giá trị.
- Ba biến bắt đầu bằng `NEXT_PUBLIC_` sẽ nằm trong trang web (ai cũng xem được) — đó là chủ ý, chúng không bí mật.
- `VAPID_PRIVATE_KEY` chỉ nằm trên máy chủ Vercel, trình duyệt không bao giờ thấy.

---

## Bước 6 — Sửa biến môi trường sau này (nếu cần)

Ví dụ khi bạn tạo khoá VAPID theo Cách B sau khi đã deploy:
1. Vercel → project **moc-coffee** → **Settings → Environment Variables** → thêm / sửa biến → **Save**.
2. Biến chỉ có tác dụng sau khi build lại: vào **Deployments** → ở bản trên cùng bấm **⋯ → Redeploy → Redeploy**.

Từ nay mỗi lần bạn cập nhật code trên GitHub (nhánh `main`), Vercel **tự build lại** sau 1–2 phút.

---

## Bước 7 — Mở trên điện thoại, tablet và kiểm tra

### Kiểm tra nhanh
Mở `https://<link>/admin` → PIN **1234** → **Thông báo đẩy**. Cả 4 dòng phải có dấu ✓ xanh:
HTTPS · App có khoá công khai · Máy chủ có khoá bí mật · Hai khoá là một cặp.
Dòng nào có **!** đỏ: xem lại biến tương ứng ở Bước 5 rồi Redeploy.

### Điện thoại khách
- Mở link `https://<link>` → đăng nhập bằng SĐT (hoặc SĐT mẫu `0901234567`).
- **iPhone**: Safari → nút **Chia sẻ** → **Thêm vào MH chính** → mở app từ biểu tượng → **Bật thông báo**
  (iPhone chỉ nhận thông báo khi app đã được thêm vào màn hình chính, iOS 16.4 trở lên).
- **Android**: Chrome → **Bật thông báo** trong app (có thể **Thêm vào màn hình chính** cho tiện).

### Tablet quầy — `/pos`
1. Mở `https://<link>/pos` bằng **Chrome** (Android) hoặc **Safari** (iPad), xoay **ngang**, nhập PIN **1234**.
2. Nên **Thêm vào màn hình chính** để mở toàn màn hình.
3. **Máy quét 2D USB/Bluetooth**: cắm USB (cần cáp OTG cho tablet) hoặc ghép Bluetooth như bàn phím.
   Máy quét phải ở chế độ **bàn phím (HID / Keyboard)** và **thêm Enter sau mã** (đa số máy để sẵn như vậy).
   Không cần chạm vào ô nhập — trang tự giữ ô quét luôn sẵn sàng.
4. Không có máy quét: bấm **Quét bằng camera** (lần đầu trình duyệt hỏi quyền camera → **Cho phép**).
5. Mã bị mờ / lỗi: gõ SĐT vào ô **Nhập SĐT tay** → **Tra**.

### Máy in tem 50×30 mm
- Sau khi bấm **Xác nhận & thu tiền**, trang tự mở hộp thoại in (tắt được bằng công tắc **Tự in tem** ở cột phải).
- Trong hộp thoại in: chọn máy in tem → khổ giấy **50 × 30 mm** → lề **Không / None** → tỉ lệ **100%** → tắt **Đầu trang & chân trang**.
- Tablet Android cần cài app/driver của hãng máy in (in qua Wi-Fi/Bluetooth); iPad cần máy in hỗ trợ **AirPrint**.
- Mỗi ly một tem; món bánh không in tem (trừ khi đơn chỉ có bánh). Có nút **In lại tem dán ly**.

### Tablet bếp — `/kitchen`
- Mở `https://<link>/kitchen`, PIN **1234**, **chạm vào màn hình 1 lần** để bật âm báo (trình duyệt bắt buộc).
- Nên tắt chế độ tự khoá màn hình của tablet (Cài đặt → Màn hình → Thời gian chờ: Không bao giờ / 30 phút).

### Kịch bản demo 5 phút
1. `/admin` → **Chế độ demo** → **Đặt lại dữ liệu mẫu**.
2. Bấm **Giả lập khách đặt đơn** → **Mở ở quầy (POS)** (hoặc quét mã QR hiện trên màn hình bằng máy khác).
3. Ở `/pos`: đối chiếu món, chọn **Tiền mặt/Chuyển khoản** → **Xác nhận & thu tiền** → tem được in, khách được cộng điểm.
4. Quét lại đúng mã đó → báo đỏ **“Đơn đã được xác nhận”** (không cộng điểm lần 2).
5. Ở `/kitchen`: đơn mới hiện ngay + chuông → **Bắt đầu pha** → **Xác nhận xong** → sau 10 giây (thời gian Hoàn tác) khách nhận thông báo
   *“Đơn #A06 đã xong, mời bạn ra quầy nhận”*.
6. Ở `/admin` → **Thực đơn**: tắt **Còn hàng** một món → app khách thấy món đó xám lại ngay.

---

## Đổi mã PIN nhân viên

Supabase → SQL Editor → chạy (thay `5678` bằng PIN mới):
```sql
update private.settings set value = '5678' where key = 'staff_pin';
```
Các tablet đang mở bấm **Khoá** rồi nhập PIN mới.

---

## Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| Trang báo **“Chưa kết nối database”** | Thiếu / sai `NEXT_PUBLIC_SUPABASE_URL` hoặc `NEXT_PUBLIC_SUPABASE_ANON_KEY` → sửa (Bước 6) → Redeploy |
| Nhập PIN 1234 báo **Sai mã PIN** | Chưa chạy `supabase/pos.sql` (Bước 2), hoặc PIN đã bị đổi trước đó → chạy lệnh đổi PIN ở trên |
| POS báo **“Could not find the function …”** | Chưa chạy `supabase/pos.sql`, hoặc chạy ở project khác với project trong biến môi trường |
| **Quét bằng camera** không mở được | Phải mở bằng link `https://`; vào cài đặt trang của trình duyệt → cho phép **Camera** |
| Máy quét gõ chữ nhưng không xử lý | Bật “thêm Enter (CR) sau mã” trong sách hướng dẫn của máy quét; kiểm tra bàn phím đang là **tiếng Anh (US)** |
| Bếp không kêu | Chạm vào màn hình bếp 1 lần (nút **Chạm để bật âm báo**), bật âm lượng tablet |
| Khách không nhận thông báo | Xem `/admin → Thông báo đẩy` đủ 4 dấu ✓; khách phải bấm **Bật thông báo** trong app (iPhone: phải thêm vào MH chính); đổi khoá VAPID thì khách phải bật lại |
| Bếp báo “khách chưa bật thông báo” | Bình thường: khách đó chưa bật thông báo, màn QR trong app của khách vẫn tự chuyển xanh + kêu khi đơn xong |
| Vercel build lỗi | Vercel → **Deployments** → bấm bản lỗi → **Building** để xem dòng đỏ; thường do thiếu file khi tải lên GitHub (Bước 1) |

---

## Ghi chú
- Trang cũ trên Render (`moc-coffee.onrender.com`) không còn gửi được thông báo sau Bước 2, vì việc gửi thông báo đã chuyển sang Vercel. Có thể xoá service đó trên Render.
- Link cũ `/staff` tự chuyển sang `/pos`.
- Đây là bản **mô phỏng cho học tập**: PIN 4 số dùng chung, chưa có đăng nhập bằng OTP. Dùng thật cần PIN dài hơn và tài khoản riêng cho từng nhân viên.
