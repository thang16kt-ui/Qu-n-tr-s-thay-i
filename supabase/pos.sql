-- =========================================================
-- Mộc Coffee — POS tại quầy (/pos), màn hình bếp (/kitchen), quản lý (/admin)
-- Chạy SAU schema.sql (Supabase → SQL Editor → dán toàn bộ file → Run).
-- Cần các cột cancelled_at / cancel_reason ở cuối schema.sql (đã có nếu chạy schema.sql bản mới).
-- Chạy lại nhiều lần được, không mất dữ liệu.
--
-- Lần chạy ĐẦU TIÊN file này sẽ:
--   · đặt PIN nhân viên = 1234 (đổi sau: update private.settings set value='xxxx' where key='staff_pin';)
--   · thêm vài thành viên + đơn mẫu cho hôm nay để demo
-- =========================================================

-- ---------- Cột mới cho đơn ----------
alter table orders add column if not exists payment_method text;   -- 'cash' | 'transfer'
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists source text not null default 'app';  -- 'app' | 'counter' | 'demo'
create index if not exists orders_confirmed_idx on orders(confirmed_at);
create index if not exists orders_created_idx on orders(created_at);

-- Thông báo "Đơn đã xong" giờ do route /api/notify (máy chủ Next.js trên Render/Vercel) gửi → bỏ trigger cũ để không gửi 2 lần
drop trigger if exists orders_done_push on orders;
drop function if exists private.on_order_done();

-- ---------- Tiện ích ----------
-- 00:00 hôm nay theo giờ Việt Nam
create or replace function private.today_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')) at time zone 'Asia/Ho_Chi_Minh'
$$;

-- Số đơn trong ngày: A01…A99, rồi B01… (đánh lại mỗi ngày). Gọi trong giao dịch đang khoá đơn.
create or replace function private.next_queue_code() returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('moc-queue-number'));
  select count(*) into n from orders where code is not null and confirmed_at >= private.today_start();
  return substr('ABCDEFGHKLMNPRSTUVXY', (n / 99) % 20 + 1, 1) || lpad(((n % 99) + 1)::text, 2, '0');
end $$;

-- Mã tạm 4 ký tự (không có I/O/0/1) cho đơn chưa đến quầy
create or replace function private.new_ref() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1), '')
  from generate_series(1, 4)
$$;

-- Thông báo đẩy của khách: lấy subscription gần nhất của thành viên (để đơn tạo tại quầy cũng báo được)
create or replace function private.latest_sub(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select push_subscription from orders
  where member_phone = p_phone and push_subscription is not null
  order by created_at desc limit 1
$$;

-- =========================================================
-- POS: quét mã
--   Có mã đơn → trả về đơn đó.  Chỉ SĐT → trả về thành viên + đơn đặt trước đang chờ (nếu có).
-- =========================================================
create or replace function public.staff_scan(p_pin text, p_phone text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m members; o orders; po orders; c text := upper(nullif(trim(coalesce(p_code, '')), ''));
begin
  perform private.check_pin(p_pin);
  perform private.check_phone(p_phone);
  perform private.expire_stale();
  insert into members(phone) values (p_phone) on conflict do nothing;
  select * into m from members where phone = p_phone;
  if c is not null then
    select * into o from orders
    where member_phone = p_phone and (ref = c or code = c)
    order by created_at desc limit 1;
  else
    select * into po from orders
    where member_phone = p_phone and status = 'pending'
    order by created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'member', to_jsonb(m),
    'order', case when o.id is null then null else private.order_json(o) end,
    'pendingOrder', case when po.id is null then null else private.order_json(po) end,
    'orderCode', c);
end $$;

-- =========================================================
-- POS: "Xác nhận & thu tiền" — CHỈ MỘT LẦN cho mỗi đơn
--   pending → confirmed, cấp số đơn, ghi hình thức thanh toán, cộng 1 điểm / 10.000đ (point_log)
-- =========================================================
create or replace function public.staff_confirm(p_pin text, p_order uuid, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; m members; pts int := 0;
begin
  perform private.check_pin(p_pin);
  if p_method is null or p_method not in ('cash', 'transfer') then
    raise exception 'Chọn hình thức thanh toán';
  end if;
  perform private.expire_stale();

  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  if o.status = 'cancelled' then raise exception 'Đơn đã bị huỷ hoặc hết hạn'; end if;
  if o.status <> 'pending' then raise exception 'Đơn đã được xác nhận'; end if;

  update orders set
    status = 'confirmed',
    code = coalesce(code, private.next_queue_code()),
    confirmed_at = now(),
    paid_at = now(),
    payment_method = p_method
  where id = p_order returning * into o;

  if not exists (select 1 from point_log where order_id = p_order and points > 0) then
    pts := floor(o.total / 10000.0);
    if pts > 0 then perform add_points(o.member_phone, o.id, pts, 'Đơn #' || o.code); end if;
  end if;
  select * into m from members where phone = o.member_phone;

  return jsonb_build_object('order', private.order_json(o), 'points', pts, 'member', to_jsonb(m));
end $$;

-- POS: huỷ đơn (chưa xong). Đơn đã cộng điểm thì trừ lại điểm đó.
create or replace function public.staff_cancel(p_pin text, p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; earned int;
begin
  perform private.check_pin(p_pin);
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  if o.status = 'cancelled' then raise exception 'Đơn đã huỷ trước đó'; end if;
  if o.status = 'done' then raise exception 'Đơn đã xong, không huỷ được'; end if;

  update orders set status = 'cancelled' where id = p_order returning * into o;
  select coalesce(sum(points), 0) into earned from point_log where order_id = p_order;
  if earned > 0 then
    perform add_points(o.member_phone, o.id, -earned, 'Huỷ đơn ' || coalesce('#' || o.code, o.ref));
  end if;
  return jsonb_build_object('order', private.order_json(o), 'points', -earned);
end $$;

-- POS: "Tạo đơn tại quầy" cho thành viên vừa quét (giá tính lại trong database)
create or replace function public.staff_create_order(p_pin text, p_phone text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_priced jsonb; v_sub int; o orders;
begin
  perform private.check_pin(p_pin);
  perform private.check_phone(p_phone);
  insert into members(phone) values (p_phone) on conflict do nothing;
  v_priced := private.price_items(p_items);
  v_sub := (v_priced->>'subtotal')::int;
  insert into orders(code, ref, member_phone, items, subtotal, discount, total, status, source, push_subscription)
  values (null, private.new_ref(), p_phone, v_priced->'lines', v_sub, 0, v_sub, 'pending', 'counter',
          private.latest_sub(p_phone))
  returning * into o;
  return private.order_json(o);
end $$;

-- =========================================================
-- BẾP: confirmed → making → done  (huỷ đi qua staff_cancel, xác nhận đi qua staff_confirm)
-- =========================================================
create or replace function public.staff_set_status(p_pin text, p_order uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; allowed text[];
begin
  perform private.check_pin(p_pin);
  if p_status = 'cancelled' then return public.staff_cancel(p_pin, p_order); end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  allowed := case o.status
    when 'confirmed' then array['making', 'done']
    when 'making'    then array['done', 'confirmed']
    else array[]::text[] end;
  if o.status = 'pending' then raise exception 'Đơn chưa được xác nhận tại quầy'; end if;
  if not (p_status = any(allowed)) then
    raise exception 'Đơn % đang ở trạng thái "%", không chuyển sang "%" được',
      coalesce('#' || o.code, o.ref), o.status, p_status;
  end if;
  update orders set
    status = p_status,
    done_at = case when p_status = 'done' then now() else null end
  where id = p_order returning * into o;
  return jsonb_build_object('order', private.order_json(o), 'points', 0,
                            'hadSubscription', o.push_subscription is not null);
end $$;

-- Route /api/notify lấy thông tin để gửi Web Push (cần PIN)
create or replace function public.staff_push_target(p_pin text, p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  perform private.check_pin(p_pin);
  select * into o from orders where id = p_order;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  return jsonb_build_object('id', o.id, 'code', o.code, 'status', o.status, 'subscription', o.push_subscription);
end $$;

-- Điện thoại khách đã huỷ đăng ký (push trả 404/410) → xoá để lần sau khỏi gửi
create or replace function public.staff_clear_push(p_pin text, p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform private.check_pin(p_pin);
  update orders set push_subscription = null where id = p_order;
end $$;

-- =========================================================
-- QUẢN LÝ THỰC ĐƠN (khách thấy ngay nhờ realtime)
-- =========================================================
create or replace function public.staff_save_menu_item(p_pin text, p_item jsonb)
returns menu_items language plpgsql security definer set search_path = public as $$
declare
  it menu_items; v_id text; v_name text; v_cat text; v_price int; v_img text; v_desc text; v_opts jsonb;
begin
  perform private.check_pin(p_pin);
  v_name := nullif(left(trim(coalesce(p_item->>'name', '')), 60), '');
  if v_name is null then raise exception 'Nhập tên món'; end if;
  v_cat := p_item->>'category';
  if v_cat is null or v_cat not in ('Cà phê', 'Trà', 'Đá xay', 'Bánh') then raise exception 'Chọn danh mục'; end if;
  begin v_price := round((p_item->>'price')::numeric)::int; exception when others then v_price := null; end;
  if v_price is null or v_price < 0 or v_price > 5000000 then raise exception 'Giá không hợp lệ'; end if;
  v_img := nullif(trim(coalesce(p_item->>'image', '')), '');
  if v_img is not null and length(v_img) > 400000 then raise exception 'Ảnh quá lớn, chọn ảnh khác nhỏ hơn'; end if;
  v_desc := nullif(left(trim(coalesce(p_item->>'description', '')), 200), '');
  v_opts := case when jsonb_typeof(p_item->'options') = 'object' then p_item->'options' else null end;
  v_id := nullif(trim(coalesce(p_item->>'id', '')), '');

  if v_id is null then
    insert into menu_items(id, category, name, description, price, image, available, options, sort)
    values ('mon-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), v_cat, v_name, v_desc, v_price, v_img,
            coalesce((p_item->>'available')::boolean, true), coalesce(v_opts, '{}'::jsonb),
            (select coalesce(max(sort), 0) + 1 from menu_items))
    returning * into it;
  else
    update menu_items set
      category = v_cat, name = v_name, description = v_desc, price = v_price, image = v_img,
      available = coalesce((p_item->>'available')::boolean, available),
      options = coalesce(v_opts, options)
    where id = v_id returning * into it;
    if not found then raise exception 'Không tìm thấy món'; end if;
  end if;
  return it;
end $$;

create or replace function public.staff_delete_menu_item(p_pin text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform private.check_pin(p_pin);
  delete from menu_items where id = p_id;
  return found;
end $$;

-- =========================================================
-- DỮ LIỆU MẪU & CHẾ ĐỘ DEMO
-- =========================================================
create or replace function private.demo_phones() returns text[]
language sql immutable as $$
  select array['0900000000','0901234567','0912345678','0987654321','0934567890','0978123456']
$$;

-- Thực đơn + ưu đãi mặc định (giống seed.sql)
create or replace function private.seed_menu() returns void
language plpgsql security definer set search_path = public as $$
declare
  drink jsonb := '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"]}';
  coffee_top jsonb := '{"toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}';
  tea_top jsonb := '{"toppings": [{"name": "Trân châu trắng", "price": 8000}, {"name": "Thạch đào", "price": 8000}, {"name": "Kem muối", "price": 8000}]}';
  ice_top jsonb := '{"toppings": [{"name": "Thêm kem tươi", "price": 6000}, {"name": "Trân châu đường đen", "price": 8000}]}';
begin
  insert into menu_items (id, category, name, description, price, image, available, options, sort) values
    ('ca-phe-den-da', 'Cà phê', 'Cà phê đen đá', 'Robusta rang mộc, đậm và thơm.', 25000, '/menu/ca-phe-den-da.svg', true, drink || coffee_top, 0),
    ('ca-phe-sua-da', 'Cà phê', 'Cà phê sữa đá', 'Phin truyền thống với sữa đặc.', 29000, '/menu/ca-phe-sua-da.svg', true, drink || coffee_top, 1),
    ('bac-xiu', 'Cà phê', 'Bạc xỉu', 'Nhiều sữa, ít cà phê, ngọt dịu.', 32000, '/menu/bac-xiu.svg', true, drink || coffee_top, 2),
    ('cold-brew-cam-sa', 'Cà phê', 'Cold brew cam sả', 'Ủ lạnh 16 giờ, thêm cam tươi và sả.', 45000, '/menu/cold-brew-cam-sa.svg', true, drink || coffee_top, 3),
    ('latte-nong', 'Cà phê', 'Latte nóng', 'Espresso cùng sữa tươi đánh mịn.', 45000, '/menu/latte-nong.svg', true, (drink || coffee_top) || '{"ice": []}', 4),
    ('tra-dao-cam-sa', 'Trà', 'Trà đào cam sả', 'Trà đen, đào miếng, cam và sả.', 45000, '/menu/tra-dao-cam-sa.svg', true, drink || tea_top, 5),
    ('tra-vai-nhai', 'Trà', 'Trà vải nhài', 'Trà nhài thanh, vải ngọt mát.', 42000, '/menu/tra-vai-nhai.svg', true, drink || tea_top, 6),
    ('tra-sen-vang', 'Trà', 'Trà sen vàng', 'Trà ô long, hạt sen bùi, kem cheese.', 45000, '/menu/tra-sen-vang.svg', false, drink || tea_top, 7),
    ('tra-sua-o-long', 'Trà', 'Trà sữa ô long nướng', 'Ô long rang thơm, sữa béo nhẹ.', 49000, '/menu/tra-sua-o-long.svg', true, drink || tea_top, 8),
    ('cookie-da-xay', 'Đá xay', 'Cookie đá xay', 'Bánh quy sô-cô-la xay cùng sữa và kem.', 55000, '/menu/cookie-da-xay.svg', true, drink || ice_top, 9),
    ('matcha-da-xay', 'Đá xay', 'Matcha đá xay', 'Matcha Nhật xay mịn, phủ kem tươi.', 55000, '/menu/matcha-da-xay.svg', true, drink || ice_top, 10),
    ('chocolate-da-xay', 'Đá xay', 'Chocolate đá xay', 'Sô-cô-la đậm vị, mát lạnh.', 52000, '/menu/chocolate-da-xay.svg', true, drink || ice_top, 11),
    ('croissant-bo', 'Bánh', 'Croissant bơ', 'Ngàn lớp, bơ Pháp, nướng mỗi sáng.', 35000, '/menu/croissant-bo.svg', true, '{"toppings": [{"name": "Hâm nóng", "price": 0}]}', 12),
    ('banh-chuoi-nuong', 'Bánh', 'Bánh chuối nướng', 'Chuối chín, nước cốt dừa, nướng thơm.', 32000, '/menu/banh-chuoi-nuong.svg', true, '{"toppings": [{"name": "Hâm nóng", "price": 0}]}', 13),
    ('tiramisu', 'Bánh', 'Tiramisu', 'Cà phê, mascarpone, bột cacao.', 45000, '/menu/tiramisu.svg', true, '{}', 14)
  on conflict (id) do update set
    category = excluded.category, name = excluded.name, description = excluded.description,
    price = excluded.price, image = excluded.image, available = excluded.available,
    options = excluded.options, sort = excluded.sort;

  insert into vouchers (id, title, description, cost_points, color, valid_days, kind, value, item_ids) values
    ('welcome-10', 'Giảm 10% đơn đầu tiên', 'Quà chào mừng thành viên mới. Áp dụng mọi món.', 0, '#C2432A', 14, 'percent', 10, '{}'),
    ('upsize-free', 'Miễn phí nâng size', 'Nâng size M lên L cho 1 ly bất kỳ.', 20, '#D4502F', 30, 'upsize', 4000, '{}'),
    ('topping-free', 'Tặng 1 topping', 'Chọn 1 topping bất kỳ, miễn phí.', 25, '#A66F12', 30, 'topping', 0, '{}'),
    ('banh-20k', 'Giảm 20.000đ món bánh', 'Áp dụng cho Croissant, Bánh chuối, Tiramisu.', 40, '#8E2E17', 30, 'item_amount', 20000, '{croissant-bo,banh-chuoi-nuong,tiramisu}'),
    ('ly-free', 'Tặng 1 ly Cà phê sữa đá', 'Size S, giảm đúng giá 1 ly khi có trong giỏ.', 60, '#3A1F15', 30, 'free_item', 0, '{ca-phe-sua-da}'),
    ('combo-2', 'Mua 1 tặng 1 Trà trái cây', 'Áp dụng Trà đào, Trà vải. Thứ 2–Thứ 5.', 90, '#8F6512', 21, 'bogo', 0, '{tra-dao-cam-sa,tra-vai-nhai}')
  on conflict (id) do update set
    title = excluded.title, description = excluded.description, cost_points = excluded.cost_points,
    color = excluded.color, valid_days = excluded.valid_days,
    kind = excluded.kind, value = excluded.value, item_ids = excluded.item_ids;
end $$;

-- Tạo 1 đơn mẫu: trạng thái + "cách đây bao nhiêu phút"
create or replace function private.demo_order(
  p_phone text, p_items jsonb, p_status text, p_created_min int,
  p_confirmed_min int default null, p_done_min int default null, p_method text default 'cash', p_source text default 'app')
returns orders language plpgsql security definer set search_path = public as $$
declare v_priced jsonb; v_sub int; o orders;
begin
  v_priced := private.price_items(p_items);
  v_sub := (v_priced->>'subtotal')::int;
  insert into orders(code, ref, member_phone, items, subtotal, discount, total, status, source,
                     created_at, confirmed_at, paid_at, payment_method, done_at, cancelled_at, cancel_reason)
  values (
    case when p_confirmed_min is not null then private.next_queue_code() end,
    private.new_ref(), p_phone, v_priced->'lines', v_sub, 0, v_sub, p_status, p_source,
    now() - make_interval(mins => p_created_min),
    case when p_confirmed_min is not null then now() - make_interval(mins => p_confirmed_min) end,
    case when p_confirmed_min is not null then now() - make_interval(mins => p_confirmed_min) end,
    case when p_confirmed_min is not null then p_method end,
    case when p_done_min is not null then now() - make_interval(mins => p_done_min) end,
    case when p_status = 'cancelled' then now() - make_interval(mins => p_created_min) + interval '30 minutes' end,
    case when p_status = 'cancelled' then 'expired' end)
  returning * into o;
  if p_confirmed_min is not null and floor(v_sub / 10000.0) > 0 then
    perform add_points(p_phone, o.id, floor(v_sub / 10000.0)::int, 'Đơn #' || o.code);
  end if;
  return o;
end $$;

-- Thành viên mẫu + đơn mẫu hôm nay (đủ các trạng thái để demo POS và bếp)
create or replace function private.seed_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into members (phone, name) values
    ('0900000000', 'Khách Mộc'), ('0901234567', 'Lan Anh'), ('0912345678', 'Minh Khoa'),
    ('0987654321', 'Thu Hà'), ('0934567890', 'Quốc Bảo'), ('0978123456', 'Gia Huy')
  on conflict (phone) do nothing;

  -- Điểm tích luỹ từ trước (để có đủ hạng)
  if not exists (select 1 from point_log where note = 'Điểm tích luỹ mẫu') then
    perform add_points('0901234567', null, 62, 'Điểm tích luỹ mẫu');
    perform add_points('0987654321', null, 168, 'Điểm tích luỹ mẫu');
    perform add_points('0934567890', null, 415, 'Điểm tích luỹ mẫu');
    perform add_points('0912345678', null, 23, 'Điểm tích luỹ mẫu');
  end if;

  -- Đơn đã xong từ lâu (bếp không hiện nữa)
  perform private.demo_order('0912345678',
    '[{"itemId":"ca-phe-sua-da","qty":2,"size":"M","sugar":"Vừa","ice":"Vừa","toppings":[]}]', 'done', 28, 27, 22);
  -- Đơn vừa xong (cột "Đã xong" của bếp)
  perform private.demo_order('0987654321',
    '[{"itemId":"tra-dao-cam-sa","qty":1,"size":"L","sugar":"Ít đường","ice":"Vừa","toppings":["Thạch đào"]},{"itemId":"croissant-bo","qty":1,"toppings":["Hâm nóng"]}]',
    'done', 12, 11, 3, 'transfer');
  -- Đang pha
  perform private.demo_order('0934567890',
    '[{"itemId":"matcha-da-xay","qty":1,"size":"M","sugar":"Vừa","ice":"Vừa","toppings":["Thêm kem tươi"]},{"itemId":"bac-xiu","qty":1,"size":"S","sugar":"Ít đường","ice":"Ít đá","toppings":[],"note":"Mang đi"}]',
    'making', 9, 8);
  -- Chờ pha (đã quá 5 phút → bếp hiện màu cam)
  perform private.demo_order('0978123456',
    '[{"itemId":"cold-brew-cam-sa","qty":2,"size":"M","sugar":"Không đường","ice":"Nhiều đá","toppings":[]}]',
    'confirmed', 8, 7, null, 'transfer', 'counter');
  -- Chờ pha (mới)
  perform private.demo_order('0900000000',
    '[{"itemId":"tra-sua-o-long","qty":1,"size":"L","sugar":"Vừa","ice":"Ít đá","toppings":["Trân châu trắng"],"note":"Ít ngọt hơn"},{"itemId":"latte-nong","qty":1,"size":"M","sugar":"Không đường","toppings":[]}]',
    'confirmed', 3, 2);
  -- Đặt trên app, chưa đến quầy (mở ở POS bằng cách nhập SĐT 0901234567)
  perform private.demo_order('0901234567',
    '[{"itemId":"cookie-da-xay","qty":1,"size":"L","sugar":"Vừa","ice":"Vừa","toppings":["Trân châu đường đen"]},{"itemId":"tiramisu","qty":1,"toppings":[]}]',
    'pending', 4);
  -- Đơn quá 30 phút không đến quầy → đã huỷ
  perform private.demo_order('0912345678',
    '[{"itemId":"ca-phe-den-da","qty":1,"size":"S","sugar":"Không đường","ice":"Vừa","toppings":[]}]',
    'cancelled', 50);
end $$;

-- Admin: "Đặt lại dữ liệu mẫu" — xoá đơn, điểm, ưu đãi đã nhận; đưa thực đơn về mặc định; tạo lại đơn mẫu.
-- Thành viên KHÔNG bị xoá (khách vẫn đăng nhập được) nhưng điểm về 0 và nhận lại quà chào mừng.
create or replace function public.staff_reset_demo(p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform private.check_pin(p_pin);
  delete from point_log where true;
  delete from orders where true;
  delete from member_vouchers where true;
  update members set points = 0, tier = 'Mầm' where true;
  delete from menu_items where id not in (
    'ca-phe-den-da','ca-phe-sua-da','bac-xiu','cold-brew-cam-sa','latte-nong','tra-dao-cam-sa','tra-vai-nhai',
    'tra-sen-vang','tra-sua-o-long','cookie-da-xay','matcha-da-xay','chocolate-da-xay','croissant-bo',
    'banh-chuoi-nuong','tiramisu');
  perform private.seed_menu();
  perform private.seed_demo();
  insert into member_vouchers(member_phone, voucher_id, expires_at)
  select phone, 'welcome-10', now() + interval '14 days' from members;
  return jsonb_build_object('ok', true,
    'orders', (select count(*) from orders), 'members', (select count(*) from members));
end $$;

-- Admin: "Giả lập khách đặt đơn" — đơn ngẫu nhiên (chờ đến quầy) cho 1 SĐT mẫu đang rảnh
create or replace function public.staff_simulate_order(p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text; v_items jsonb := '[]'::jsonb; it menu_items; v_priced jsonb; v_sub int; o orders;
  n_sizes int; n_sugar int; n_ice int; n_top int;
begin
  perform private.check_pin(p_pin);
  perform private.expire_stale();
  insert into members (phone, name) values
    ('0900000000', 'Khách Mộc'), ('0901234567', 'Lan Anh'), ('0912345678', 'Minh Khoa'),
    ('0987654321', 'Thu Hà'), ('0934567890', 'Quốc Bảo'), ('0978123456', 'Gia Huy')
  on conflict (phone) do nothing;

  select m.phone into v_phone from members m
  where m.phone = any(private.demo_phones())
    and not exists (select 1 from orders x where x.member_phone = m.phone and x.status in ('pending','confirmed','making'))
  order by random() limit 1;
  if v_phone is null then
    raise exception 'Cả 6 số điện thoại mẫu đều đang có đơn chưa xong — hãy xử lý bớt đơn rồi thử lại';
  end if;

  for it in select * from menu_items where available order by random() limit 1 + floor(random() * 3)::int loop
    n_sizes := jsonb_array_length(coalesce(it.options->'sizes', '[]'::jsonb));
    n_sugar := jsonb_array_length(coalesce(it.options->'sugar', '[]'::jsonb));
    n_ice   := jsonb_array_length(coalesce(it.options->'ice', '[]'::jsonb));
    n_top   := jsonb_array_length(coalesce(it.options->'toppings', '[]'::jsonb));
    v_items := v_items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'itemId', it.id,
      'qty', case when random() < 0.25 then 2 else 1 end,
      'size',  case when n_sizes > 0 then it.options->'sizes'->(floor(random() * n_sizes)::int)->>'name' end,
      'sugar', case when n_sugar > 0 then it.options->'sugar'->>(floor(random() * n_sugar)::int) end,
      'ice',   case when n_ice > 0 then it.options->'ice'->>(floor(random() * n_ice)::int) end,
      'toppings', case when n_top > 0 and random() < 0.35
                       then jsonb_build_array(it.options->'toppings'->(floor(random() * n_top)::int)->>'name')
                       else '[]'::jsonb end,
      'note', case when random() < 0.25
                   then (array['Ít ngọt hơn','Để riêng đá','Mang đi','Không lấy ống hút'])[1 + floor(random() * 4)::int] end)));
  end loop;
  if jsonb_array_length(v_items) = 0 then raise exception 'Thực đơn đang hết hàng hết'; end if;

  v_priced := private.price_items(v_items);
  v_sub := (v_priced->>'subtotal')::int;
  insert into orders(code, ref, member_phone, items, subtotal, discount, total, status, source, push_subscription)
  values (null, private.new_ref(), v_phone, v_priced->'lines', v_sub, 0, v_sub, 'pending', 'demo', private.latest_sub(v_phone))
  returning * into o;
  return private.order_json(o);
end $$;

-- =========================================================
-- Quyền gọi hàm từ trình duyệt (mỗi hàm tự kiểm tra PIN)
-- =========================================================
grant execute on function
  public.staff_scan(text, text, text), public.staff_confirm(text, uuid, text), public.staff_cancel(text, uuid),
  public.staff_create_order(text, text, jsonb), public.staff_set_status(text, uuid, text),
  public.staff_push_target(text, uuid), public.staff_clear_push(text, uuid),
  public.staff_save_menu_item(text, jsonb), public.staff_delete_menu_item(text, text),
  public.staff_reset_demo(text), public.staff_simulate_order(text)
to anon, authenticated;

-- =========================================================
-- Đơn "pending" quá 30 phút chưa xác nhận → "cancelled"
-- Chạy tự động mỗi phút bằng pg_cron (nếu bật được); các màn POS/bếp cũng tự dọn khi thao tác.
-- =========================================================
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'Không bật được pg_cron (%). Đơn vẫn tự huỷ khi nhân viên thao tác.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('moc-expire-orders', '* * * * *', 'select private.expire_stale()');
  end if;
end $$;

-- =========================================================
-- Lần chạy đầu: PIN = 1234 + dữ liệu mẫu
-- =========================================================
do $$
begin
  if not exists (select 1 from menu_items) then perform private.seed_menu(); end if;
  if not exists (select 1 from private.settings where key = 'pos_installed') then
    insert into private.settings(key, value) values ('staff_pin', '1234')
    on conflict (key) do update set value = excluded.value;
    begin
      perform private.seed_demo();
    exception when others then
      raise notice 'Bỏ qua đơn mẫu (%). Có thể tạo lại ở /admin → Đặt lại dữ liệu mẫu.', sqlerrm;
    end;
    insert into private.settings(key, value) values ('pos_installed', now()::text);
  end if;
end $$;
