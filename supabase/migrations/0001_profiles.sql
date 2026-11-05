-- Fundora — profils et rôles (plan « comptes », phase A).
-- Inscription libre : chaque compte est créé « user » et « active », sans validation d'un admin.
-- Le rôle « super_admin » ne se donne jamais depuis l'application : il est attribué à la main
-- dans la base (voir la requête de promotion en fin de fichier).

create type public.app_role as enum ('user', 'super_admin');
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  last_sync_at timestamptz
);

-- Création automatique du profil à l'inscription.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Un utilisateur lit uniquement son propre profil.
create policy "profiles: lecture de son propre profil"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Aucune politique d'écriture pour les utilisateurs : rôle et statut ne peuvent pas être modifiés
-- depuis le client. Les écritures passent par les fonctions d'administration (phase E).
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Fonction utilitaire pour les politiques d'administration (phases B et E).
create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Promotion du premier super administrateur (à exécuter une fois, dans le SQL Editor, après inscription) :
-- update public.profiles set role = 'super_admin' where email = 'votre-email@exemple.be';
