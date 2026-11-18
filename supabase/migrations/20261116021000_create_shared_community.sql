create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Usuario Pet Nova',
  pet_name text not null default 'Comunidad Pet Nova',
  content text not null check (char_length(trim(content)) between 1 and 500),
  post_type text not null check (post_type in ('post', 'poll')),
  image_path text,
  poll_options jsonb,
  created_at timestamptz not null default now(),
  constraint community_posts_poll_options_check check (
    case
      when post_type = 'post' then poll_options is null
      when post_type = 'poll' then
        coalesce(
          jsonb_typeof(poll_options) = 'array'
          and jsonb_array_length(poll_options) between 2 and 5,
          false
        )
      else false
    end
  )
);

alter table public.community_posts enable row level security;
grant select, insert, delete on public.community_posts to authenticated;

create or replace function public.set_community_post_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
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

drop trigger if exists set_community_post_author on public.community_posts;
create trigger set_community_post_author
before insert on public.community_posts
for each row execute function public.set_community_post_author();

drop policy if exists "Authenticated users can read community posts" on public.community_posts;
create policy "Authenticated users can read community posts"
on public.community_posts
for select to authenticated
using (true);

drop policy if exists "Authenticated users can create their own community posts" on public.community_posts;
create policy "Authenticated users can create their own community posts"
on public.community_posts
for insert to authenticated
with check (
  user_id = auth.uid()
  and (image_path is null or image_path like auth.uid()::text || '/%')
);

drop policy if exists "Authors can delete their own community posts" on public.community_posts;
create policy "Authors can delete their own community posts"
on public.community_posts
for delete to authenticated
using (user_id = auth.uid());

create table if not exists public.community_poll_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  voter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

alter table public.community_poll_votes enable row level security;
revoke all on public.community_poll_votes from anon, authenticated;

create or replace function public.cast_community_poll_vote(p_post_id uuid, p_option_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  options jsonb;
  inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para votar.' using errcode = '28000';
  end if;

  select post.poll_options
    into options
    from public.community_posts as post
    where post.id = p_post_id and post.post_type = 'poll';

  if options is null then
    raise exception 'No se encontró la encuesta.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from jsonb_array_elements(options) as item(value)
      where item.value ->> 'id' = p_option_id
  ) then
    raise exception 'La opción de voto no es válida.' using errcode = '22023';
  end if;

  insert into public.community_poll_votes (post_id, voter_id, option_id)
  values (p_post_id, auth.uid(), p_option_id)
  on conflict (post_id, voter_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'Ya votaste en esta encuesta.' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.get_community_poll_results(p_post_ids uuid[])
returns table (
  post_id uuid,
  option_id text,
  vote_count bigint,
  user_vote_option text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    post.id,
    option.value ->> 'id',
    count(vote.post_id)::bigint,
    (
      select own_vote.option_id
        from public.community_poll_votes as own_vote
        where own_vote.post_id = post.id and own_vote.voter_id = auth.uid()
        limit 1
    )
  from public.community_posts as post
  cross join lateral jsonb_array_elements(post.poll_options) as option(value)
  left join public.community_poll_votes as vote
    on vote.post_id = post.id and vote.option_id = option.value ->> 'id'
  where auth.uid() is not null
    and post.post_type = 'poll'
    and post.id = any(p_post_ids)
  group by post.id, option.value ->> 'id';
$$;

revoke all on function public.cast_community_poll_vote(uuid, text) from public;
revoke all on function public.get_community_poll_results(uuid[]) from public;
grant execute on function public.cast_community_poll_vote(uuid, text) to authenticated;
grant execute on function public.get_community_poll_results(uuid[]) to authenticated;

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
