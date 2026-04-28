# Supabase setup for Favorite Books sync

## 1) Create table

Run in Supabase SQL editor:

```sql
create table if not exists public.favorite_books (
  id text primary key,
  last_saved text not null default '',
  books jsonb not null default '{}'::jsonb
);
```

## 2) Insert shared row

```sql
insert into public.favorite_books (id, last_saved, books)
values ('shared', '', '{}'::jsonb)
on conflict (id) do nothing;
```

## 3) RLS policy (simple open version)

```sql
alter table public.favorite_books enable row level security;

create policy "public read favorite_books"
on public.favorite_books
for select
to anon
using (true);

create policy "public upsert favorite_books"
on public.favorite_books
for insert
to anon
with check (true);

create policy "public update favorite_books"
on public.favorite_books
for update
to anon
using (true)
with check (true);
```

## 4) Fill `sync-config.js`

```js
window.FAVORITE_BOOKS_SYNC = {
  provider: "supabase",
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  table: "favorite_books",
  rowId: "shared"
};
```

## Notes

- This setup lets anyone with site access update the shared books list.
- If you need edit protection later, add auth/sign-in and tighten RLS.
