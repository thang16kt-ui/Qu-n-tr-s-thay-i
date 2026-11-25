-- =========================================================
-- Mộc Coffee — cấu trúc database (chạy trong Supabase → SQL Editor)
-- Chạy file này TRƯỚC, sau đó chạy seed.sql
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

-- ---------- Ưu đãi (dữ liệu mẫu) ----------
create table if not exists vouchers (
  id          text primary key,
  title       text not null,
  description text,
  cost_points integer not null default 0,       -- điểm cần để đổi
  color       text default '#C47A4A',
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

-- =========================================================
-- Hàm: tính hạng theo tổng điểm đã TÍCH LUỸ (không giảm khi đổi quà)
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

-- Cộng điểm (atomic): ghi log + cập nhật điểm + cập nhật hạng
create or replace function add_points(p_phone text, p_order uuid, p_points integer, p_note text)
returns members language plpgsql security definer as $$
declare m members;
begin
  insert into point_log(member_phone, order_id, points, note)
  values (p_phone, p_order, p_points, p_note);

  update members set
    points = points + p_points,
    tier = tier_for((select coalesce(sum(points),0)::int from point_log
                     where member_phone = p_phone and points > 0))
  where phone = p_phone
  returning * into m;
  return m;
end $$;

-- Đổi ưu đãi bằng điểm
create or replace function redeem_voucher(p_phone text, p_voucher text)
returns member_vouchers language plpgsql security definer as $$
declare v vouchers; m members; mv member_vouchers;
begin
  select * into v from vouchers where id = p_voucher and active;
  if not found then raise exception 'Ưu đãi không tồn tại'; end if;

  select * into m from members where phone = p_phone for update;
  if not found then raise exception 'Không tìm thấy thành viên'; end if;
  if m.points < v.cost_points then raise exception 'Bạn chưa đủ điểm để đổi ưu đãi này'; end if;

  update members set points = points - v.cost_points where phone = p_phone;
  insert into point_log(member_phone, points, note)
  values (p_phone, -v.cost_points, 'Đổi: ' || v.title);

  insert into member_vouchers(member_phone, voucher_id, expires_at)
  values (p_phone, v.id, now() + make_interval(days => v.valid_days))
  returning * into mv;
  return mv;
end $$;

-- =========================================================
-- Bảo mật (RLS)
-- Bản mô phỏng: KHÔNG có mật khẩu, nên trình duyệt chỉ được ĐỌC.
-- Mọi thao tác GHI đi qua API của app (dùng service role key ở server).
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

-- Trình duyệt không được gọi trực tiếp các hàm cộng/trừ điểm
revoke execute on function add_points(text, uuid, integer, text) from public, anon, authenticated;
revoke execute on function redeem_voucher(text, text) from public, anon, authenticated;
grant  execute on function add_points(text, uuid, integer, text) to service_role;
grant  execute on function redeem_voucher(text, text) to service_role;

-- =========================================================
-- Realtime: menu, đơn hàng, điểm thành viên
-- =========================================================
do $$
begin
  begin alter publication supabase_realtime add table menu_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table orders;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table members;    exception when duplicate_object then null; end;
end $$;
