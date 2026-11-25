-- =========================================================
-- Mộc Coffee — database + toàn bộ logic (chạy trong Supabase → SQL Editor)
-- Thứ tự: schema.sql → seed.sql → settings.example.sql (điền giá trị của bạn)
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Thành viên ----------
create table if not exists members (
  phone       text primary key,                 -- SĐT = mã thành viên
  name        text,
  points      integer not null default 0,       -- điểm hiện có (dùng để đổi ưu đãi)
  tier        text not null default 'Mầm',      -- Mầm · Chồi · Cây · Cổ thụ
  created_at  timestamptz not null default now()
);

-- ---------- Thực đơn ----------
create table if not exists menu_items (
  id          text primary key,
  category    text not null check (category in ('Cà phê','Trà','Đá xay','Bánh')),
  name        text not null,
  description text,
  price       integer not null,                 -- VNĐ
  image       text,                             -- đường dẫn ảnh, vd /menu/bac-xiu.svg
  available   boolean not null default true,
  options     jsonb not null default '{}'::jsonb,
  sort        integer not null default 0
);

-- ---------- Đơn hàng ----------
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,              -- số đơn hiển thị, vd A12
  member_phone      text not null references members(phone) on delete cascade,
  items             jsonb not null,
  total             integer not null,
  status            text not null default 'pending'
                    check (status in ('pending','confirmed','making','done','cancelled')),
  push_subscription jsonb,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz,
  done_at           timestamptz
);
create index if not exists orders_member_idx on orders(member_phone, created_at desc);
create index if not exists orders_status_idx on orders(status, created_at desc);

-- ---------- Lịch sử điểm ----------
create table if not exists point_log (
  id           bigint generated always as identity primary key,
  member_phone text not null references members(phone) on delete cascade,
  order_id     uuid references orders(id) on delete set null,
  points       integer not null,                -- dương = cộng, âm = trừ khi đổi ưu đãi
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists point_log_member_idx on point_log(member_phone, created_at desc);
create index if not exists point_log_order_idx on point_log(order_id);

-- ---------- Ưu đãi (dữ liệu mẫu) ----------
create table if not exists vouchers (
  id          text primary key,
  title       text not null,
  description text,
  cost_points integer not null default 0,       -- điểm cần để đổi
  color       text default '#C2432A',
  valid_days  integer not null default 30,
  active      boolean not null default true
);

-- Ưu đãi thành viên đã có (đổi bằng điểm hoặc được tặng)
create table if not exists member_vouchers (
  id           uuid primary key default gen_random_uuid(),
  member_phone text not null references members(phone) on delete cascade,
  voucher_id   text not null references vouchers(id) on delete cascade,
  code         text not null default upper(substr(md5(random()::text), 1, 6)),
  used         boolean not null default false,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists member_vouchers_member_idx on member_vouchers(member_phone);
create index if not exists member_vouchers_voucher_idx on member_vouchers(voucher_id);

-- =========================================================
-- Bảo mật (RLS): trình duyệt chỉ được ĐỌC bảng.
-- Mọi thao tác GHI đi qua các hàm bên dưới (security definer).
-- =========================================================
alter table members         enable row level security;
alter table menu_items      enable row level security;
alter table orders          enable row level security;
alter table point_log       enable row level security;
alter table vouchers        enable row level security;
alter table member_vouchers enable row level security;

drop policy if exists "read members" on members;
drop policy if exists "read menu" on menu_items;
drop policy if exists "read orders" on orders;
drop policy if exists "read point_log" on point_log;
drop policy if exists "read vouchers" on vouchers;
drop policy if exists "read member_vouchers" on member_vouchers;
create policy "read members"         on members         for select using (true);
create policy "read menu"            on menu_items      for select using (true);
create policy "read orders"          on orders          for select using (true);
create policy "read point_log"       on point_log       for select using (true);
create policy "read vouchers"        on vouchers        for select using (true);
create policy "read member_vouchers" on member_vouchers for select using (true);

grant usage on schema public to anon, authenticated;
grant select on members, menu_items, orders, point_log, vouchers, member_vouchers to anon, authenticated;

-- Realtime: menu, đơn hàng, điểm thành viên
do $$
begin
  begin alter publication supabase_realtime add table menu_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table orders;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table members;    exception when duplicate_object then null; end;
end $$;

-- =========================================================
-- Cấu hình bí mật (schema "private" không mở ra API)
--   staff_pin, vapid_public, vapid_private, vapid_subject, push_url
-- =========================================================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);

create or replace function private.setting(k text) returns text
language sql stable security definer set search_path = '' as $$
  select value from private.settings where key = k
$$;

create or replace function private.check_phone(p text) returns void
language plpgsql immutable as $$
begin
  if p is null or p !~ '^0[0-9]{9}$' then raise exception 'Số điện thoại không hợp lệ'; end if;
end $$;

create or replace function private.check_pin(p text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p is null or p is distinct from private.setting('staff_pin') then
    raise exception 'Sai mã PIN nhân viên';
  end if;
end $$;

-- Đơn "Chờ xác nhận" quá 30 phút → huỷ
create or replace function private.expire_stale() returns void
language sql security definer set search_path = '' as $$
  update public.orders set status = 'cancelled'
  where status = 'pending' and created_at < now() - interval '30 minutes'
$$;

create or replace function private.order_json(o public.orders) returns jsonb
language sql immutable as $$ select to_jsonb(o) - 'push_subscription' $$;

-- =========================================================
-- Điểm & hạng
-- =========================================================
create or replace function tier_for(total_earned integer) returns text
language sql immutable as $$
  select case
    when total_earned >= 400 then 'Cổ thụ'
    when total_earned >= 150 then 'Cây'
    when total_earned >= 50  then 'Chồi'
    else 'Mầm'
  end;
$$;

-- Cộng/trừ điểm (atomic). Hạng tính theo tổng điểm đã TÍCH LUỸ.
create or replace function add_points(p_phone text, p_order uuid, p_points integer, p_note text)
returns members language plpgsql security definer set search_path = public as $$
declare m members;
begin
  insert into point_log(member_phone, order_id, points, note) values (p_phone, p_order, p_points, p_note);
  update members set
    points = points + p_points,
    tier = tier_for((select coalesce(sum(points),0)::int from point_log where member_phone = p_phone and points > 0))
  where phone = p_phone
  returning * into m;
  return m;
end $$;

-- =========================================================
-- Hàm cho KHÁCH
-- =========================================================

-- Đăng nhập bằng SĐT = tạo thành viên nếu chưa có (+ voucher chào mừng)
create or replace function member_login(p_phone text) returns members
language plpgsql security definer set search_path = public as $$
declare m members; v vouchers;
begin
  perform private.check_phone(p_phone);
  select * into m from members where phone = p_phone;
  if found then return m; end if;
  insert into members(phone) values (p_phone) on conflict do nothing returning * into m;
  if not found then
    select * into m from members where phone = p_phone;
    return m;
  end if;
  select * into v from vouchers where id = 'welcome-10' and active;
  if found then
    insert into member_vouchers(member_phone, voucher_id, expires_at)
    values (p_phone, v.id, now() + make_interval(days => v.valid_days));
  end if;
  return m;
end $$;

create or replace function member_set_name(p_phone text, p_name text) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  perform private.check_phone(p_phone);
  update members set name = nullif(left(trim(coalesce(p_name, '')), 40), '')
  where phone = p_phone returning * into m;
  return m;
end $$;

-- Gắn Web Push vào đơn đang chờ (khi khách bật thông báo sau khi đặt)
create or replace function attach_push(p_phone text, p_order uuid, p_sub jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_sub) <> 'object' or not (p_sub ? 'endpoint') then return false; end if;
  update orders set push_subscription = p_sub
  where id = p_order and member_phone = p_phone and status in ('pending','confirmed','making');
  return found;
end $$;

-- Đổi ưu đãi bằng điểm
create or replace function redeem_voucher(p_phone text, p_voucher text)
returns member_vouchers language plpgsql security definer set search_path = public as $$
declare v vouchers; m members; mv member_vouchers;
begin
  select * into v from vouchers where id = p_voucher and active;
  if not found then raise exception 'Ưu đãi không tồn tại'; end if;
  select * into m from members where phone = p_phone for update;
  if not found then raise exception 'Không tìm thấy thành viên'; end if;
  if m.points < v.cost_points then raise exception 'Bạn chưa đủ điểm để đổi ưu đãi này'; end if;

  update members set points = points - v.cost_points where phone = p_phone;
  insert into point_log(member_phone, points, note) values (p_phone, -v.cost_points, 'Đổi: ' || v.title);
  insert into member_vouchers(member_phone, voucher_id, expires_at)
  values (p_phone, v.id, now() + make_interval(days => v.valid_days))
  returning * into mv;
  return mv;
end $$;

-- =========================================================
-- Hàm cho NHÂN VIÊN (cần mã PIN)
-- =========================================================
create or replace function staff_check(p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
begin perform private.check_pin(p_pin); return true; end $$;

create or replace function staff_scan(p_pin text, p_phone text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m members; o orders;
begin
  perform private.check_pin(p_pin);
  perform private.check_phone(p_phone);
  perform private.expire_stale();
  insert into members(phone) values (p_phone) on conflict do nothing;
  select * into m from members where phone = p_phone;
  if coalesce(p_code, '') <> '' then
    select * into o from orders where member_phone = p_phone and code = p_code order by created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'member', to_jsonb(m),
    'order', case when o.id is null then null else private.order_json(o) end,
    'orderCode', nullif(p_code, ''));
end $$;

-- Đổi trạng thái: xác nhận (cộng điểm) → đang pha → đã xong (trigger gửi push) / huỷ
create or replace function staff_set_status(p_pin text, p_order uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; allowed text[]; pts int := 0;
begin
  perform private.check_pin(p_pin);
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  allowed := case o.status
    when 'pending'   then array['confirmed','making','done','cancelled']
    when 'confirmed' then array['making','done','cancelled']
    when 'making'    then array['done','cancelled']
    else array[]::text[] end;
  if not (p_status = any(allowed)) then
    raise exception 'Đơn #% đã ở trạng thái "%", không chuyển sang "%" được', o.code, o.status, p_status;
  end if;

  update orders set
    status = p_status,
    confirmed_at = case when p_status <> 'cancelled' then coalesce(confirmed_at, now()) else confirmed_at end,
    done_at = case when p_status = 'done' then now() else done_at end
  where id = p_order returning * into o;

  if p_status <> 'cancelled' and not exists (select 1 from point_log where order_id = p_order) then
    pts := floor(o.total / 10000.0);
    if pts > 0 then perform add_points(o.member_phone, o.id, pts, 'Đơn #' || o.code); end if;
  end if;

  return jsonb_build_object('order', private.order_json(o), 'points', pts,
                            'hadSubscription', o.push_subscription is not null);
end $$;

-- Tích điểm cho hoá đơn mua tại quầy (mã QR chỉ có SĐT)
create or replace function staff_add_points(p_pin text, p_phone text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pts int; m members;
begin
  perform private.check_pin(p_pin);
  perform private.check_phone(p_phone);
  if p_amount is null or p_amount <= 0 or p_amount > 10000000 then raise exception 'Số tiền không hợp lệ'; end if;
  pts := floor(p_amount / 10000.0);
  if pts <= 0 then raise exception 'Hoá đơn dưới 10.000đ chưa được tích điểm'; end if;
  insert into members(phone) values (p_phone) on conflict do nothing;
  m := add_points(p_phone, null, pts,
       'Hoá đơn tại quầy ' || replace(to_char(p_amount, 'FM999,999,999'), ',', '.') || 'đ');
  return jsonb_build_object('member', to_jsonb(m), 'points', pts);
end $$;

-- Bật / tắt "hết hàng" (khách thấy ngay nhờ realtime)
create or replace function staff_set_available(p_pin text, p_id text, p_available boolean)
returns menu_items language plpgsql security definer set search_path = public as $$
declare it menu_items;
begin
  perform private.check_pin(p_pin);
  update menu_items set available = p_available where id = p_id returning * into it;
  if not found then raise exception 'Không tìm thấy món'; end if;
  return it;
end $$;

-- Quyền gọi hàm
revoke execute on function add_points(text, uuid, integer, text) from public, anon, authenticated;
grant  execute on function member_login(text), member_set_name(text, text),
       attach_push(text, uuid, jsonb), redeem_voucher(text, text),
       staff_check(text), staff_scan(text, text, text), staff_set_status(text, uuid, text),
       staff_add_points(text, text, integer), staff_set_available(text, text, boolean)
  to anon, authenticated;

-- =========================================================
-- Ưu đãi trong giỏ hàng: cột bổ sung (an toàn khi chạy lại)
-- =========================================================
alter table vouchers add column if not exists kind text not null default 'percent';
alter table vouchers add column if not exists value integer not null default 0;
alter table vouchers add column if not exists item_ids text[] not null default '{}';
alter table orders add column if not exists subtotal integer;
alter table orders add column if not exists discount integer not null default 0;
alter table orders add column if not exists voucher_id uuid references member_vouchers(id) on delete set null;
alter table orders add column if not exists voucher_title text;
create index if not exists orders_voucher_idx on orders(voucher_id);

-- Tính giá các món trong giỏ (giá lấy từ thực đơn, không tin trình duyệt)
create or replace function private.price_items(p_items jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_it jsonb; v_m menu_items; v_opts jsonb; v_arr jsonb;
  v_lines jsonb := '[]'::jsonb; v_total int := 0; v_qty int; v_price int; v_extra int;
  v_size text; v_sugar text; v_ice text; v_tops jsonb; v_note text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng đang trống';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Giỏ hàng quá nhiều món'; end if;

  for v_it in select value from jsonb_array_elements(p_items) loop
    select * into v_m from menu_items where id = v_it->>'itemId';
    if not found then raise exception 'Có món không còn trong thực đơn'; end if;
    if not v_m.available then raise exception '% vừa hết hàng, vui lòng bỏ khỏi giỏ', v_m.name; end if;

    v_opts  := coalesce(v_m.options, '{}'::jsonb);
    v_qty   := greatest(1, least(20, floor(coalesce((v_it->>'qty')::numeric, 1))::int));
    v_price := v_m.price;

    v_size := null; v_extra := 0;
    v_arr := coalesce(v_opts->'sizes', '[]'::jsonb);
    if jsonb_array_length(v_arr) > 0 then
      select s->>'name', (s->>'price')::int into v_size, v_extra
      from jsonb_array_elements(v_arr) s where s->>'name' = v_it->>'size' limit 1;
      if v_size is null then v_size := v_arr->0->>'name'; v_extra := (v_arr->0->>'price')::int; end if;
      v_price := v_price + coalesce(v_extra, 0);
    end if;

    v_arr := coalesce(v_opts->'sugar', '[]'::jsonb);
    v_sugar := case when jsonb_array_length(v_arr) = 0 then null
                    when v_arr ? (v_it->>'sugar') then v_it->>'sugar'
                    else v_arr->>least(2, jsonb_array_length(v_arr) - 1) end;
    v_arr := coalesce(v_opts->'ice', '[]'::jsonb);
    v_ice := case when jsonb_array_length(v_arr) = 0 then null
                  when v_arr ? (v_it->>'ice') then v_it->>'ice'
                  else v_arr->>least(2, jsonb_array_length(v_arr) - 1) end;

    select coalesce(jsonb_agg(tp->>'name' order by ord), '[]'::jsonb), coalesce(sum((tp->>'price')::int), 0)
      into v_tops, v_extra
    from jsonb_array_elements(coalesce(v_opts->'toppings', '[]'::jsonb)) with ordinality as x(tp, ord)
    where jsonb_typeof(v_it->'toppings') = 'array' and (v_it->'toppings') ? (tp->>'name');
    v_price := v_price + v_extra;

    v_note := nullif(left(trim(coalesce(v_it->>'note', '')), 120), '');

    v_lines := v_lines || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'itemId', v_m.id, 'name', v_m.name, 'image', v_m.image, 'qty', v_qty,
      'unitPrice', v_price, 'lineTotal', v_price * v_qty,
      'size', v_size, 'sugar', v_sugar, 'ice', v_ice, 'toppings', v_tops, 'note', v_note)));
    v_total := v_total + v_price * v_qty;
  end loop;
  return jsonb_build_object('lines', v_lines, 'subtotal', v_total);
end $$;

-- Số tiền giảm của 1 ưu đãi cho giỏ hàng → {discount, reason}
--   percent: giảm value% · upsize: giảm value khi có ly size L · topping: tặng topping đắt nhất
--   item_amount: giảm tối đa value cho các món item_ids · free_item: tặng 1 món item_ids (giá gốc)
--   bogo: mua 1 tặng 1 trong item_ids, Thứ 2–Thứ 5
create or replace function private.voucher_discount(v public.vouchers, p_lines jsonb, p_subtotal int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d int := 0; n int; dow int;
begin
  case v.kind
  when 'percent' then
    d := round(p_subtotal * v.value / 100.0);
  when 'upsize' then
    if not exists (select 1 from jsonb_array_elements(p_lines) l where l->>'size' = 'L') then
      return jsonb_build_object('discount', 0, 'reason', 'Cần có ít nhất 1 ly size L');
    end if;
    d := v.value;
  when 'topping' then
    select max((tp->>'price')::int) into d
    from jsonb_array_elements(p_lines) l
    join menu_items m on m.id = l->>'itemId'
    cross join lateral jsonb_array_elements(coalesce(m.options->'toppings', '[]'::jsonb)) tp
    where coalesce(l->'toppings', '[]'::jsonb) ? (tp->>'name');
    if coalesce(d, 0) = 0 then
      return jsonb_build_object('discount', 0, 'reason', 'Cần chọn ít nhất 1 topping có phí');
    end if;
  when 'item_amount' then
    select coalesce(sum((l->>'lineTotal')::int), 0) into n
    from jsonb_array_elements(p_lines) l where (l->>'itemId') = any(v.item_ids);
    if n = 0 then return jsonb_build_object('discount', 0, 'reason', 'Giỏ hàng chưa có món áp dụng'); end if;
    d := least(v.value, n);
  when 'free_item' then
    select min(m.price) into d
    from jsonb_array_elements(p_lines) l join menu_items m on m.id = l->>'itemId'
    where m.id = any(v.item_ids);
    if d is null then return jsonb_build_object('discount', 0, 'reason', 'Giỏ hàng chưa có món áp dụng'); end if;
  when 'bogo' then
    dow := extract(isodow from now() at time zone 'Asia/Ho_Chi_Minh');
    if dow > 4 then return jsonb_build_object('discount', 0, 'reason', 'Chỉ áp dụng Thứ 2 – Thứ 5'); end if;
    select coalesce(sum((l->>'qty')::int), 0), min((l->>'unitPrice')::int) into n, d
    from jsonb_array_elements(p_lines) l where (l->>'itemId') = any(v.item_ids);
    if n < 2 then return jsonb_build_object('discount', 0, 'reason', 'Cần ít nhất 2 ly món áp dụng'); end if;
  else
    d := 0;
  end case;
  return jsonb_build_object('discount', greatest(0, least(coalesce(d, 0), p_subtotal)), 'reason', null);
end $$;

-- Xem trước: mỗi voucher của khách giảm được bao nhiêu cho giỏ hàng hiện tại
create or replace function public.preview_vouchers(p_phone text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_priced jsonb; v_out jsonb := '[]'::jsonb; r record; dd jsonb;
begin
  perform private.check_phone(p_phone);
  begin
    v_priced := private.price_items(p_items);
  exception when others then
    v_priced := jsonb_build_object('lines', '[]'::jsonb, 'subtotal', 0);
  end;
  for r in
    select mv.id, mv.code, mv.expires_at, v
    from member_vouchers mv join vouchers v on v.id = mv.voucher_id
    where mv.member_phone = p_phone and not mv.used and mv.expires_at > now()
    order by mv.created_at
  loop
    dd := private.voucher_discount(r.v, v_priced->'lines', (v_priced->>'subtotal')::int);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'code', r.code, 'expires_at', r.expires_at,
      'title', (r.v).title, 'description', (r.v).description, 'color', (r.v).color,
      'discount', (dd->>'discount')::int, 'reason', dd->>'reason'));
  end loop;
  return v_out;
end $$;

-- Đặt món (có thể kèm 1 voucher)
drop function if exists public.place_order(text, jsonb, jsonb);
create or replace function public.place_order(p_phone text, p_items jsonb, p_sub jsonb default null, p_voucher uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_active text; v_priced jsonb; v_subtotal int; v_disc int := 0; v_title text; v_mv_id uuid;
  v_mv member_vouchers; v_v vouchers; dd jsonb; v_count int; v_code text; v_order orders;
begin
  perform private.check_phone(p_phone);
  if not exists (select 1 from members where phone = p_phone) then
    raise exception 'Không tìm thấy thành viên, vui lòng đăng nhập lại';
  end if;

  perform private.expire_stale();
  perform pg_advisory_xact_lock(hashtext('moc-place-order'));

  -- Mỗi khách chỉ 1 đơn đang chờ
  select o.code into v_active from orders o
  where o.member_phone = p_phone and o.status in ('pending','confirmed','making') limit 1;
  if v_active is not null then
    raise exception 'Bạn đang có đơn #% chưa xong. Đưa mã QR cho nhân viên hoặc chờ đơn xong nhé.', v_active;
  end if;

  v_priced := private.price_items(p_items);
  v_subtotal := (v_priced->>'subtotal')::int;

  if p_voucher is not null then
    select * into v_mv from member_vouchers where id = p_voucher and member_phone = p_phone for update;
    if not found or v_mv.used or v_mv.expires_at <= now() then
      raise exception 'Ưu đãi này không còn dùng được';
    end if;
    select * into v_v from vouchers where id = v_mv.voucher_id;
    dd := private.voucher_discount(v_v, v_priced->'lines', v_subtotal);
    v_disc := (dd->>'discount')::int;
    if v_disc <= 0 then
      raise exception 'Không áp dụng được ưu đãi: %', coalesce(dd->>'reason', 'không đủ điều kiện');
    end if;
    v_title := v_v.title;
    v_mv_id := v_mv.id;
    update member_vouchers set used = true where id = v_mv.id;
  end if;

  -- Số đơn trong ngày (giờ VN): A1…A99, B1…
  select count(*) into v_count from orders
  where created_at >= (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
  v_code := substr('ABCDEFGH', (v_count / 99) % 8 + 1, 1) || ((v_count % 99) + 1)::text;

  insert into orders(code, member_phone, items, subtotal, discount, total, voucher_id, voucher_title, status, push_subscription)
  values (v_code, p_phone, v_priced->'lines', v_subtotal, v_disc, v_subtotal - v_disc, v_mv_id, v_title, 'pending',
          case when jsonb_typeof(p_sub) = 'object' and p_sub ? 'endpoint' then p_sub end)
  returning * into v_order;
  return private.order_json(v_order);
end $$;

-- Đơn bị huỷ / hết hạn → trả lại voucher cho khách
create or replace function private.on_order_cancel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.voucher_id is not null then
    update public.member_vouchers set used = false where id = new.voucher_id;
  end if;
  return new;
end $$;
drop trigger if exists orders_cancel_release on public.orders;
create trigger orders_cancel_release after update of status on public.orders
for each row execute function private.on_order_cancel();

grant execute on function public.preview_vouchers(text, jsonb), public.place_order(text, jsonb, jsonb, uuid) to anon, authenticated;

-- =========================================================
-- Web Push: khi đơn chuyển "Đã xong" → gọi Edge Function send-push
-- =========================================================
create extension if not exists pg_net with schema extensions;

create or replace function private.on_order_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status is distinct from 'done'
     and new.push_subscription is not null and private.setting('push_url') is not null then
    perform net.http_post(
      url := private.setting('push_url'),
      body := jsonb_build_object(
        'subscription', new.push_subscription,
        'title', 'Mộc Coffee',
        'body', 'Đơn #' || new.code || ' đã xong, mời bạn ra quầy nhận',
        'tag', 'order-' || new.id,
        'url', 'orders/?id=' || new.id,
        'vapid', jsonb_build_object(
          'publicKey', private.setting('vapid_public'),
          'privateKey', private.setting('vapid_private'),
          'subject', coalesce(private.setting('vapid_subject'), 'mailto:admin@example.com'))),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  end if;
  return new;
end $$;

drop trigger if exists orders_done_push on orders;
create trigger orders_done_push after update of status on orders
for each row execute function private.on_order_done();

-- =========================================================
-- HÀNG CHỜ CÔNG BẰNG: ai đến quầy trước làm trước
--  · Đặt món trên app chỉ tạo đơn "pending" với MÃ TẠM (ref, 4 ký tự) — chưa có số thứ tự,
--    máy nhân viên KHÔNG thấy đơn này.
--  · Khi khách đến quầy và nhân viên quét mã → đơn vào hàng chờ, được cấp SỐ THỨ TỰ (A1, A2…)
--    theo thứ tự quét. Đơn không đến quầy trong 30 phút tự hết hạn (chống đơn ảo).
-- =========================================================
alter table orders add column if not exists ref text;
alter table orders alter column code drop not null;
update orders set ref = coalesce(ref, code) where ref is null;
update orders set code = null where status = 'pending';
create index if not exists orders_ref_idx on orders(member_phone, ref);

create or replace function public.place_order(p_phone text, p_items jsonb, p_sub jsonb default null, p_voucher uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_active text; v_priced jsonb; v_subtotal int; v_disc int := 0; v_title text; v_mv_id uuid;
  v_mv member_vouchers; v_v vouchers; dd jsonb; v_ref text; v_order orders;
begin
  perform private.check_phone(p_phone);
  if not exists (select 1 from members where phone = p_phone) then
    raise exception 'Không tìm thấy thành viên, vui lòng đăng nhập lại';
  end if;

  perform private.expire_stale();
  perform pg_advisory_xact_lock(hashtext('moc-place-order:' || p_phone));

  -- Mỗi khách chỉ 1 đơn đang chờ (vì chỉ có MỘT mã QR)
  select coalesce('#' || o.code, 'mã ' || o.ref) into v_active from orders o
  where o.member_phone = p_phone and o.status in ('pending','confirmed','making') limit 1;
  if v_active is not null then
    raise exception 'Bạn đang có đơn % chưa xong. Mang mã QR đến quầy hoặc chờ đơn xong nhé.', v_active;
  end if;

  v_priced := private.price_items(p_items);
  v_subtotal := (v_priced->>'subtotal')::int;

  if p_voucher is not null then
    select * into v_mv from member_vouchers where id = p_voucher and member_phone = p_phone for update;
    if not found or v_mv.used or v_mv.expires_at <= now() then
      raise exception 'Ưu đãi này không còn dùng được';
    end if;
    select * into v_v from vouchers where id = v_mv.voucher_id;
    dd := private.voucher_discount(v_v, v_priced->'lines', v_subtotal);
    v_disc := (dd->>'discount')::int;
    if v_disc <= 0 then
      raise exception 'Không áp dụng được ưu đãi: %', coalesce(dd->>'reason', 'không đủ điều kiện');
    end if;
    v_title := v_v.title;
    v_mv_id := v_mv.id;
    update member_vouchers set used = true where id = v_mv.id;
  end if;

  -- Mã tạm 4 ký tự (dễ đọc, không có I/O/0/1); số thứ tự chỉ cấp khi quét tại quầy
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1), '')
    into v_ref from generate_series(1, 4);

  insert into orders(code, ref, member_phone, items, subtotal, discount, total, voucher_id, voucher_title, status, push_subscription)
  values (null, v_ref, p_phone, v_priced->'lines', v_subtotal, v_disc, v_subtotal - v_disc, v_mv_id, v_title, 'pending',
          case when jsonb_typeof(p_sub) = 'object' and p_sub ? 'endpoint' then p_sub end)
  returning * into v_order;
  return private.order_json(v_order);
end $$;

create or replace function public.staff_scan(p_pin text, p_phone text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m members; o orders;
begin
  perform private.check_pin(p_pin);
  perform private.check_phone(p_phone);
  perform private.expire_stale();
  insert into members(phone) values (p_phone) on conflict do nothing;
  select * into m from members where phone = p_phone;
  if coalesce(p_code, '') <> '' then
    select * into o from orders
    where member_phone = p_phone and (ref = p_code or code = p_code)
    order by created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'member', to_jsonb(m),
    'order', case when o.id is null then null else private.order_json(o) end,
    'orderCode', nullif(p_code, ''));
end $$;

-- Quét mã & nhận đơn → cấp số thứ tự theo giờ quét, cộng điểm; sau đó đang pha → đã xong (push) / huỷ
create or replace function public.staff_set_status(p_pin text, p_order uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; allowed text[]; pts int := 0; v_count int; v_code text;
begin
  perform private.check_pin(p_pin);
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
  allowed := case o.status
    when 'pending'   then array['confirmed','cancelled']
    when 'confirmed' then array['making','done','cancelled']
    when 'making'    then array['done','cancelled']
    else array[]::text[] end;
  if not (p_status = any(allowed)) then
    raise exception 'Đơn % đã ở trạng thái "%", không chuyển sang "%" được',
      coalesce('#' || o.code, 'mã ' || o.ref), o.status, p_status;
  end if;

  -- Lần đầu nhận đơn tại quầy: cấp số thứ tự tiếp theo trong ngày (giờ VN)
  if p_status <> 'cancelled' and o.code is null then
    perform pg_advisory_xact_lock(hashtext('moc-queue-number'));
    select count(*) into v_count from orders
    where code is not null
      and confirmed_at >= (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh');
    v_code := substr('ABCDEFGH', (v_count / 99) % 8 + 1, 1) || ((v_count % 99) + 1)::text;
  end if;

  update orders set
    status = p_status,
    code = coalesce(code, v_code),
    confirmed_at = case when p_status <> 'cancelled' then coalesce(confirmed_at, now()) else confirmed_at end,
    done_at = case when p_status = 'done' then now() else done_at end
  where id = p_order returning * into o;

  if p_status <> 'cancelled' and not exists (select 1 from point_log where order_id = p_order) then
    pts := floor(o.total / 10000.0);
    if pts > 0 then perform add_points(o.member_phone, o.id, pts, 'Đơn #' || o.code); end if;
  end if;

  return jsonb_build_object('order', private.order_json(o), 'points', pts,
                            'hadSubscription', o.push_subscription is not null);
end $$;

grant execute on function public.place_order(text, jsonb, jsonb, uuid), public.staff_scan(text, text, text),
  public.staff_set_status(text, uuid, text) to anon, authenticated;

-- =========================================================
-- Lưu thời điểm & lý do huỷ đơn (hết hạn / khách huỷ / quầy huỷ)
-- =========================================================
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancel_reason text
  check (cancel_reason in ('expired','customer','staff'));

-- Mọi lần chuyển sang 'cancelled' đều được đóng dấu thời gian (mặc định: quầy huỷ)
create or replace function private.stamp_cancel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancel_reason := coalesce(new.cancel_reason, 'staff');
  end if;
  return new;
end $$;
drop trigger if exists orders_stamp_cancel on public.orders;
create trigger orders_stamp_cancel before update of status on public.orders
for each row execute function private.stamp_cancel();

-- Hết hạn: thời điểm huỷ = lúc đặt + 30 phút (đúng lúc đơn hết hạn, không phải lúc hệ thống dọn)
create or replace function private.expire_stale() returns void
language sql security definer set search_path = '' as $$
  update public.orders
  set status = 'cancelled', cancel_reason = 'expired', cancelled_at = created_at + interval '30 minutes'
  where status = 'pending' and created_at < now() - interval '30 minutes'
$$;

-- Khách tự huỷ đơn nháp: giữ lại trong lịch sử, ghi giờ huỷ
create or replace function public.cancel_order(p_phone text, p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'cancelled', cancel_reason = 'customer', cancelled_at = now()
  where id = p_order and member_phone = p_phone and status = 'pending';
  if not found then
    raise exception 'Đơn đã được quầy nhận hoặc không còn tồn tại';
  end if;
  return true;
end $$;
grant execute on function public.cancel_order(text, uuid) to anon, authenticated;

-- Đơn đã huỷ từ trước: đơn chưa từng được quét → coi là hết hạn
update public.orders
set cancel_reason = 'expired', cancelled_at = created_at + interval '30 minutes'
where status = 'cancelled' and cancelled_at is null and confirmed_at is null;
