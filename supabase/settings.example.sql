-- Đổi mã PIN nhân viên (dùng chung cho /pos, /kitchen, /admin). Mặc định là 1234.
-- Sửa số trong dấu nháy rồi chạy trong Supabase → SQL Editor.
update private.settings set value = '1234' where key = 'staff_pin';
