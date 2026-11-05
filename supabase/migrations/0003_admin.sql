-- Fundora — console super administrateur (plan « comptes », phase E).
-- Toutes les fonctions vérifient is_super_admin() : un utilisateur ordinaire ne peut rien lire ni modifier ici.
-- Le super administrateur voit le contenu des comptes (décision du propriétaire, sans chiffrement de bout en bout).

create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null,
  target_id uuid,
  target_email text,
  at timestamptz not null default now()
);

-- Aucune politique : la table n'est lisible et écrivable que par les fonctions ci-dessous.
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

create function public.require_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Liste des comptes avec le nombre d'enregistrements actifs.
create function public.admin_list_accounts()
returns table (
  id uuid,
  email text,
  role public.app_role,
  status public.account_status,
  created_at timestamptz,
  last_sync_at timestamptz,
  record_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_super_admin();
  return query
    select p.id, p.email, p.role, p.status, p.created_at, p.last_sync_at,
      (select count(*) from public.sync_records s where s.user_id = p.id and not s.deleted)
    from public.profiles p
    order by p.created_at desc;
end;
$$;

-- Enregistrements d'un compte pour une table donnée. Chaque consultation est journalisée.
create function public.admin_list_records(p_user uuid, p_table text, p_limit integer default 100)
returns table (record_id text, updated_at timestamptz, data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  perform public.require_super_admin();
  select email into target_email from public.profiles where id = p_user;
  insert into public.admin_audit (admin_id, action, target_id, target_email)
  values (auth.uid(), 'view:' || p_table, p_user, target_email);
  return query
    select s.record_id, s.updated_at, s.data
    from public.sync_records s
    where s.user_id = p_user and s.table_name = p_table and not s.deleted
    order by s.updated_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

-- Suspendre ou réactiver. On ne peut pas modifier son propre compte.
create function public.admin_set_status(p_user uuid, p_status public.account_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  perform public.require_super_admin();
  if p_user = auth.uid() then
    raise exception 'cannot change own status' using errcode = '22023';
  end if;
  select email into target_email from public.profiles where id = p_user;
  update public.profiles set status = p_status where id = p_user;
  insert into public.admin_audit (admin_id, action, target_id, target_email)
  values (auth.uid(), case when p_status = 'suspended' then 'suspend' else 'reactivate' end, p_user, target_email);
end;
$$;

-- Supprimer un compte : le profil et les enregistrements disparaissent par cascade.
create function public.admin_delete_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_email text;
begin
  perform public.require_super_admin();
  if p_user = auth.uid() then
    raise exception 'cannot delete own account' using errcode = '22023';
  end if;
  select email into target_email from public.profiles where id = p_user;
  insert into public.admin_audit (admin_id, action, target_id, target_email)
  values (auth.uid(), 'delete', p_user, target_email);
  delete from auth.users where id = p_user;
end;
$$;

-- Journal des actions administratives, le plus récent d'abord.
create function public.admin_audit_list(p_limit integer default 200)
returns table (id bigint, admin_id uuid, action text, target_id uuid, target_email text, at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_super_admin();
  return query
    select a.id, a.admin_id, a.action, a.target_id, a.target_email, a.at
    from public.admin_audit a
    order by a.at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

revoke all on function public.require_super_admin() from public, anon;
revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_list_records(uuid, text, integer) from public, anon;
revoke all on function public.admin_set_status(uuid, public.account_status) from public, anon;
revoke all on function public.admin_delete_account(uuid) from public, anon;
revoke all on function public.admin_audit_list(integer) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_list_records(uuid, text, integer) to authenticated;
grant execute on function public.admin_set_status(uuid, public.account_status) to authenticated;
grant execute on function public.admin_delete_account(uuid) to authenticated;
grant execute on function public.admin_audit_list(integer) to authenticated;
