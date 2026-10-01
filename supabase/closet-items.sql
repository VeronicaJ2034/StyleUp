create table if not exists public.closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  color text not null,
  tone text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists closet_items_user_id_created_at_idx
on public.closet_items (user_id, created_at desc);

alter table public.closet_items enable row level security;

create policy "Users can view their own closet items"
on public.closet_items for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own closet items"
on public.closet_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own closet items"
on public.closet_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own closet items"
on public.closet_items for delete
to authenticated
using (auth.uid() = user_id);
