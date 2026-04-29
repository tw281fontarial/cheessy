-- Tournament posters storage (Supabase)
-- Bucket: tournament-posters (public)
-- NOTE: This project does NOT use Supabase Auth. Therefore, "authenticated" policies won't work.
-- This migration provides a simple STARTER setup:
-- - public read
-- - anon upload (TEMPORARY legacy setup)
-- A later migration drops this policy after backend signed uploads are enabled.

-- 1) Create public bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('tournament-posters', 'tournament-posters', true)
on conflict (id) do update set public = true;

-- 2) Public read for everyone
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public read tournament-posters') then
    create policy "public read tournament-posters"
      on storage.objects
      for select
      using (bucket_id = 'tournament-posters');
  end if;
end $$;

-- 3) TEMPORARY: allow anon uploads to this bucket
-- This is required when uploading from frontend using anon key without Supabase Auth.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'anon upload tournament-posters') then
    create policy "anon upload tournament-posters"
      on storage.objects
      for insert
      with check (bucket_id = 'tournament-posters');
  end if;
end $$;
