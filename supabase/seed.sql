-- =========================================================
-- Mộc Coffee — dữ liệu mẫu (chạy SAU schema.sql)
-- Chạy lại nhiều lần được: món/ưu đãi sẽ được cập nhật, không nhân đôi
-- =========================================================

insert into menu_items (id, category, name, description, price, image, available, options, sort) values
  ('ca-phe-den-da', 'Cà phê', 'Cà phê đen đá', 'Robusta rang mộc, đậm và thơm.', 25000, '/menu/ca-phe-den-da.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 0),
  ('ca-phe-sua-da', 'Cà phê', 'Cà phê sữa đá', 'Phin truyền thống với sữa đặc.', 29000, '/menu/ca-phe-sua-da.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 1),
  ('bac-xiu', 'Cà phê', 'Bạc xỉu', 'Nhiều sữa, ít cà phê, ngọt dịu.', 32000, '/menu/bac-xiu.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 2),
  ('cold-brew-cam-sa', 'Cà phê', 'Cold brew cam sả', 'Ủ lạnh 16 giờ, thêm cam tươi và sả.', 45000, '/menu/cold-brew-cam-sa.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 3),
  ('latte-nong', 'Cà phê', 'Latte nóng', 'Espresso cùng sữa tươi đánh mịn.', 45000, '/menu/latte-nong.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": [], "toppings": [{"name": "Thêm shot espresso", "price": 10000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 4),
  ('tra-dao-cam-sa', 'Trà', 'Trà đào cam sả', 'Trà đen, đào miếng, cam và sả.', 45000, '/menu/tra-dao-cam-sa.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Trân châu trắng", "price": 8000}, {"name": "Thạch đào", "price": 8000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 5),
  ('tra-vai-nhai', 'Trà', 'Trà vải nhài', 'Trà nhài thanh, vải ngọt mát.', 42000, '/menu/tra-vai-nhai.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Trân châu trắng", "price": 8000}, {"name": "Thạch đào", "price": 8000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 6),
  ('tra-sen-vang', 'Trà', 'Trà sen vàng', 'Trà ô long, hạt sen bùi, kem cheese.', 45000, '/menu/tra-sen-vang.svg', false, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Trân châu trắng", "price": 8000}, {"name": "Thạch đào", "price": 8000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 7),
  ('tra-sua-o-long', 'Trà', 'Trà sữa ô long nướng', 'Ô long rang thơm, sữa béo nhẹ.', 49000, '/menu/tra-sua-o-long.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Trân châu trắng", "price": 8000}, {"name": "Thạch đào", "price": 8000}, {"name": "Kem muối", "price": 8000}]}'::jsonb, 8),
  ('cookie-da-xay', 'Đá xay', 'Cookie đá xay', 'Bánh quy sô-cô-la xay cùng sữa và kem.', 55000, '/menu/cookie-da-xay.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm kem tươi", "price": 6000}, {"name": "Trân châu đường đen", "price": 8000}]}'::jsonb, 9),
  ('matcha-da-xay', 'Đá xay', 'Matcha đá xay', 'Matcha Nhật xay mịn, phủ kem tươi.', 55000, '/menu/matcha-da-xay.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm kem tươi", "price": 6000}, {"name": "Trân châu đường đen", "price": 8000}]}'::jsonb, 10),
  ('chocolate-da-xay', 'Đá xay', 'Chocolate đá xay', 'Sô-cô-la đậm vị, mát lạnh.', 52000, '/menu/chocolate-da-xay.svg', true, '{"sizes": [{"name": "S", "price": 0}, {"name": "M", "price": 6000}, {"name": "L", "price": 10000}], "sugar": ["Không đường", "Ít đường", "Vừa", "Nhiều đường"], "ice": ["Không đá", "Ít đá", "Vừa", "Nhiều đá"], "toppings": [{"name": "Thêm kem tươi", "price": 6000}, {"name": "Trân châu đường đen", "price": 8000}]}'::jsonb, 11),
  ('croissant-bo', 'Bánh', 'Croissant bơ', 'Ngàn lớp, bơ Pháp, nướng mỗi sáng.', 35000, '/menu/croissant-bo.svg', true, '{"toppings": [{"name": "Hâm nóng", "price": 0}]}'::jsonb, 12),
  ('banh-chuoi-nuong', 'Bánh', 'Bánh chuối nướng', 'Chuối chín, nước cốt dừa, nướng thơm.', 32000, '/menu/banh-chuoi-nuong.svg', true, '{"toppings": [{"name": "Hâm nóng", "price": 0}]}'::jsonb, 13),
  ('tiramisu', 'Bánh', 'Tiramisu', 'Cà phê, mascarpone, bột cacao.', 45000, '/menu/tiramisu.svg', true, '{}'::jsonb, 14)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, description = excluded.description,
  price = excluded.price, image = excluded.image, available = excluded.available,
  options = excluded.options, sort = excluded.sort;

insert into vouchers (id, title, description, cost_points, color, valid_days) values
  ('welcome-10', 'Giảm 10% đơn đầu tiên', 'Quà chào mừng thành viên mới. Áp dụng mọi món.', 0, '#C47A4A', 14),
  ('upsize-free', 'Miễn phí nâng size', 'Nâng size M lên L cho 1 ly bất kỳ.', 20, '#A0673F', 30),
  ('topping-free', 'Tặng 1 topping', 'Chọn 1 topping bất kỳ, miễn phí.', 25, '#8A5A3B', 30),
  ('banh-20k', 'Giảm 20.000đ món bánh', 'Áp dụng cho Croissant, Bánh chuối, Tiramisu.', 40, '#6E4A33', 30),
  ('ly-free', 'Tặng 1 ly Cà phê sữa đá', 'Size S, đổi tại quầy.', 60, '#4A3226', 30),
  ('combo-2', 'Mua 1 tặng 1 Trà trái cây', 'Áp dụng Trà đào, Trà vải. Thứ 2–Thứ 5.', 90, '#B8875C', 21)
on conflict (id) do update set
  title = excluded.title, description = excluded.description, cost_points = excluded.cost_points,
  color = excluded.color, valid_days = excluded.valid_days;

-- Thành viên mẫu để thử nhanh: đăng nhập bằng 0900000000
insert into members (phone, name, points, tier) values ('0900000000', 'Khách Mộc', 0, 'Mầm')
on conflict (phone) do nothing;
