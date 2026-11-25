-- Cấu hình bí mật — KHÔNG commit giá trị thật. Sửa các giá trị trong <> rồi chạy trong SQL Editor.
insert into private.settings(key, value) values
  ('staff_pin',     '<mã PIN nhân viên, vd 6 số>'),
  ('vapid_public',  '<Public Key từ: npm run vapid>'),
  ('vapid_private', '<Private Key từ: npm run vapid>'),
  ('vapid_subject', 'mailto:<email của bạn>'),
  ('push_url',      'https://<project-ref>.supabase.co/functions/v1/send-push')
on conflict (key) do update set value = excluded.value;
