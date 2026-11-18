create table if not exists public.pet_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Usuario Pet Nova',
  caption text not null default '' check (char_length(caption) <= 120),
  image_path text not null,
  legacy_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists pet_moments_legacy_id_unique
  on public.pet_moments (user_id, legacy_id)
  where legacy_id is not null;
create index if not exists pet_moments_created_at_idx
  on public.pet_moments (created_at desc);

alter table public.pet_moments enable row level security;
grant select, insert, delete on public.pet_moments to authenticated;

create or replace function public.set_pet_moment_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para publicar un momento.' using errcode = '28000';
  end if;

  new.user_id := auth.uid();
  select coalesce(nullif(profile.name, ''), 'Usuario Pet Nova')
    into new.author_name
    from public.profiles as profile
    where profile.id = auth.uid();
  if new.author_name is null then
    new.author_name := 'Usuario Pet Nova';
  end if;
  return new;
end;
$$;

drop trigger if exists set_pet_moment_author on public.pet_moments;
create trigger set_pet_moment_author
before insert on public.pet_moments
for each row execute function public.set_pet_moment_author();

drop policy if exists "Authenticated users can read pet moments" on public.pet_moments;
create policy "Authenticated users can read pet moments"
on public.pet_moments
for select to authenticated
using (true);

drop policy if exists "Users can create their own pet moments" on public.pet_moments;
create policy "Users can create their own pet moments"
on public.pet_moments
for insert to authenticated
with check (
  user_id = auth.uid()
  and image_path like auth.uid()::text || '/%'
);

drop policy if exists "Authors can delete their own pet moments" on public.pet_moments;
create policy "Authors can delete their own pet moments"
on public.pet_moments
for delete to authenticated
using (user_id = auth.uid());

create table if not exists public.pet_moment_likes (
  moment_id uuid not null references public.pet_moments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

alter table public.pet_moment_likes enable row level security;
revoke all on public.pet_moment_likes from anon, authenticated;
grant insert, delete on public.pet_moment_likes to authenticated;

drop policy if exists "Users can like moments as themselves" on public.pet_moment_likes;
create policy "Users can like moments as themselves"
on public.pet_moment_likes
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can remove their own moment likes" on public.pet_moment_likes;
create policy "Users can remove their own moment likes"
on public.pet_moment_likes
for delete to authenticated
using (user_id = auth.uid());

create table if not exists public.pet_moment_comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.pet_moments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Usuario Pet Nova',
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists pet_moment_comments_moment_created_idx
  on public.pet_moment_comments (moment_id, created_at desc);

alter table public.pet_moment_comments enable row level security;
grant select, insert, delete on public.pet_moment_comments to authenticated;

create or replace function public.set_pet_moment_comment_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para comentar.' using errcode = '28000';
  end if;

  new.user_id := auth.uid();
  select coalesce(nullif(profile.name, ''), 'Usuario Pet Nova')
    into new.author_name
    from public.profiles as profile
    where profile.id = auth.uid();
  if new.author_name is null then
    new.author_name := 'Usuario Pet Nova';
  end if;
  return new;
end;
$$;

drop trigger if exists set_pet_moment_comment_author on public.pet_moment_comments;
create trigger set_pet_moment_comment_author
before insert on public.pet_moment_comments
for each row execute function public.set_pet_moment_comment_author();

drop policy if exists "Authenticated users can read pet moment comments" on public.pet_moment_comments;
create policy "Authenticated users can read pet moment comments"
on public.pet_moment_comments
for select to authenticated
using (true);

drop policy if exists "Users can comment as themselves" on public.pet_moment_comments;
create policy "Users can comment as themselves"
on public.pet_moment_comments
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own moment comments" on public.pet_moment_comments;
create policy "Users can delete their own moment comments"
on public.pet_moment_comments
for delete to authenticated
using (user_id = auth.uid());

create or replace function public.get_pet_moment_reactions(p_moment_ids uuid[])
returns table (
  moment_id uuid,
  like_count bigint,
  viewer_liked boolean,
  comment_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    moment.id,
    (select count(*) from public.pet_moment_likes as reaction where reaction.moment_id = moment.id),
    exists (
      select 1
      from public.pet_moment_likes as own_reaction
      where own_reaction.moment_id = moment.id and own_reaction.user_id = auth.uid()
    ),
    (select count(*) from public.pet_moment_comments as comment where comment.moment_id = moment.id)
  from public.pet_moments as moment
  where auth.uid() is not null and moment.id = any(p_moment_ids);
$$;

revoke all on function public.get_pet_moment_reactions(uuid[]) from public;
grant execute on function public.get_pet_moment_reactions(uuid[]) to authenticated;

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read community media" on storage.objects;
create policy "Authenticated users can read community media"
on storage.objects
for select to authenticated
using (bucket_id = 'community-media');

drop policy if exists "Users can upload their own community media" on storage.objects;
create policy "Users can upload their own community media"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own community media" on storage.objects;
create policy "Users can delete their own community media"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
