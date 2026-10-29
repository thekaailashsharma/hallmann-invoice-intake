-- Who may use the review screen. Identity comes from Firebase Auth (email/password); the role lives here.
create type user_role as enum ('clerk', 'lead', 'admin');
create table app_users (
  email        text primary key,
  display_name text not null,
  role         user_role not null default 'clerk',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text
);
-- Seed: Avanai creates the first admin; the admin adds Jana and Thomas in the app.
insert into app_users (email, display_name, role, created_by) values
  ('kailashps.1011@gmail.com', 'Kailash (Avanai)', 'admin', 'seed');
