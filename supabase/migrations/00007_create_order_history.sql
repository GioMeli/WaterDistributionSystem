
create table if not exists order_history (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  file_size bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_name text,
  notes text
);

alter table order_history enable row level security;

-- Admins can do everything
create policy "admin_all_order_history"
  on order_history for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
