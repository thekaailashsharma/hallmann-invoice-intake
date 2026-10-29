-- Small settings store. super_admin_key is a bcrypt hash (pgcrypto); checked by the n8n "User Admin" form.
create table app_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
