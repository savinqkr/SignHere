-- SignHere: Supabase schema

-- sessions 테이블
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  sign_position jsonb not null,
  signature_image text,
  status text not null default 'pending' check (status in ('pending', 'signed')),
  signed_file_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Index for fast lookup by status
create index if not exists sessions_status_idx on sessions(status);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- Row Level Security
alter table sessions enable row level security;

-- Allow anonymous reads and inserts (needed for the app)
create policy "Allow public read" on sessions
  for select using (true);

create policy "Allow public insert" on sessions
  for insert with check (true);

create policy "Allow public update" on sessions
  for update using (true);

-- Storage bucket (run in Supabase dashboard or via CLI)
-- insert into storage.buckets (id, name, public) values ('contracts', 'contracts', true);
--
-- Storage policies
-- create policy "Allow public upload" on storage.objects
--   for insert with check (bucket_id = 'contracts');
--
-- create policy "Allow public read" on storage.objects
--   for select using (bucket_id = 'contracts');
