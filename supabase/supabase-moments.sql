-- Pet Nova · Pet Moments compartido con la comunidad
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run

-- Álbumes (los ven todos los usuarios con sesión)
create table if not exists public.moment_albums (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author      text not null check (char_length(author) between 1 and 80),
  title       text not null check (char_length(title) between 1 and 60),
  cover       text not null default '' check (char_length(cover) <= 60000),
  created_at  timestamptz not null default now()
);

-- Fotos de cada álbum
create table if not exists public.moment_photos (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.moment_albums (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author      text not null check (char_length(author) between 1 and 80),
  caption     text not null default '' check (char_length(caption) <= 120),
  image       text not null check (char_length(image) <= 600000),
  created_at  timestamptz not null default now()
);
create index if not exists moment_photos_album_idx on public.moment_photos (album_id, created_at);

-- Me gusta (una persona solo puede dar un me gusta por foto)
create table if not exists public.moment_likes (
  photo_id    uuid not null references public.moment_photos (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- Comentarios
create table if not exists public.moment_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.moment_photos (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author      text not null check (char_length(author) between 1 and 80),
  content     text not null check (char_length(content) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index if not exists moment_comments_photo_idx on public.moment_comments (photo_id, created_at);

-- Seguridad: todos con sesión pueden VER; cada quien solo crea y borra LO SUYO
alter table public.moment_albums   enable row level security;
alter table public.moment_photos   enable row level security;
alter table public.moment_likes    enable row level security;
alter table public.moment_comments enable row level security;

grant select, insert, update, delete on public.moment_albums   to authenticated;
grant select, insert, delete         on public.moment_photos   to authenticated;
grant select, insert, delete         on public.moment_likes    to authenticated;
grant select, insert, delete         on public.moment_comments to authenticated;

-- Álbumes
drop policy if exists "Ver álbumes" on public.moment_albums;
create policy "Ver álbumes" on public.moment_albums for select to authenticated using (true);
drop policy if exists "Crear mis álbumes" on public.moment_albums;
create policy "Crear mis álbumes" on public.moment_albums for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Editar mis álbumes" on public.moment_albums;
create policy "Editar mis álbumes" on public.moment_albums for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Borrar mis álbumes" on public.moment_albums;
create policy "Borrar mis álbumes" on public.moment_albums for delete to authenticated using ((select auth.uid()) = user_id);

-- Fotos (solo puedes agregar fotos a TUS álbumes)
drop policy if exists "Ver fotos" on public.moment_photos;
create policy "Ver fotos" on public.moment_photos for select to authenticated using (true);
drop policy if exists "Subir fotos a mis álbumes" on public.moment_photos;
create policy "Subir fotos a mis álbumes" on public.moment_photos for insert to authenticated
  with check ((select auth.uid()) = user_id
              and exists (select 1 from public.moment_albums a where a.id = album_id and a.user_id = (select auth.uid())));
drop policy if exists "Borrar mis fotos" on public.moment_photos;
create policy "Borrar mis fotos" on public.moment_photos for delete to authenticated using ((select auth.uid()) = user_id);

-- Me gusta
drop policy if exists "Ver me gusta" on public.moment_likes;
create policy "Ver me gusta" on public.moment_likes for select to authenticated using (true);
drop policy if exists "Dar me gusta" on public.moment_likes;
create policy "Dar me gusta" on public.moment_likes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Quitar mi me gusta" on public.moment_likes;
create policy "Quitar mi me gusta" on public.moment_likes for delete to authenticated using ((select auth.uid()) = user_id);

-- Comentarios
drop policy if exists "Ver comentarios" on public.moment_comments;
create policy "Ver comentarios" on public.moment_comments for select to authenticated using (true);
drop policy if exists "Comentar" on public.moment_comments;
create policy "Comentar" on public.moment_comments for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Borrar mis comentarios" on public.moment_comments;
create policy "Borrar mis comentarios" on public.moment_comments for delete to authenticated using ((select auth.uid()) = user_id);
