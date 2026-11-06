-- Fundora — consultation « voir comme un utilisateur » et changement de rôle (plan « comptes », phase G).
-- Lecture seule : aucune fonction ci-dessous n'écrit dans sync_records d'un autre compte.
-- Chaque ouverture et fermeture de consultation est journalisée dans admin_audit.

-- 1. Un super administrateur suspendu perd ses droits d'administration.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

-- 2. Changer le rôle d'un autre compte. Refusé pour son propre compte et pour le dernier super administrateur actif.
create function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
  current_role public.app_role;
begin
  perform public.require_super_admin();
  if p_user = auth.uid() then
    raise exception 'cannot change own role' using errcode = '22023';
  end if;
  select email, role into target_email, current_role from public.profiles where id = p_user;
  if target_email is null then
    raise exception 'account not found' using errcode = '22023';
  end if;
  if current_role = 'super_admin' and p_role <> 'super_admin' and not exists (
    select 1 from public.profiles
    where role = 'super_admin' and status = 'active' and id <> p_user
  ) then
    raise exception 'at least one super admin is required' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.admin_audit (admin_id, action, target_id, target_email)
  values (auth.uid(), case when p_role = 'super_admin' then 'role_super_admin' else 'role_user' end, p_user, target_email);
end;
$$;

-- 3. Début de consultation : vérifie le compte cible, journalise, renvoie son e-mail.
create function public.admin_consult_start(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  perform public.require_super_admin();
  if p_user = auth.uid() then
    raise exception 'cannot consult own account' using errcode = '22023';
  end if;
  select email into target_email from public.profiles where id = p_user;
  if target_email is null then
    raise exception 'account not found' using errcode = '22023';
  end if;
  insert into public.admin_audit (admin_id, action, target_id, target_email)
  values (auth.uid(), 'consult_start', p_user, target_email);
  return target_email;
end;
$$;

-- 4. Lecture des enregistrements du compte consulté, par pages. Lecture seule.
--    Curseur complet (changed_at, table, identifiant) : plusieurs lignes peuvent partager le même changed_at
--    (un envoi groupé les horodate pareil), et une page ne doit jamais en sauter une.
--    Les pierres tombales sont renvoyées ; le client les ignore.
create function public.admin_consult_pull(
  p_user uuid,
  p_after timestamptz default null,
  p_after_table text default '',
  p_after_record text default '',
  p_limit integer default 500
)
returns table (
  table_name text,
  record_id text,
  updated_at timestamptz,
  deleted boolean,
  data jsonb,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_super_admin();
  return query
    select s.table_name, s.record_id, s.updated_at, s.deleted, s.data, s.changed_at
    from public.sync_records s
    where s.user_id = p_user
      and (p_after is null
           or (s.changed_at, s.table_name, s.record_id) > (p_after, p_after_table, p_after_record))
    order by s.changed_at asc, s.table_name asc, s.record_id asc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

-- 5. Fin de consultation (fermeture volontaire, rechargement ou déconnexion).
create function public.admin_consult_end(p_user uuid)
returns void
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
  values (auth.uid(), 'consult_end', p_user, target_email);
end;
$$;

-- 6. Suppression d'entrées du journal par le super administrateur (uniquement lui ; le journal reste invisible aux autres).
--    Décision du propriétaire : les entrées sélectionnées sont supprimées définitivement, sans trace supplémentaire.
create function public.admin_audit_delete(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  perform public.require_super_admin();
  delete from public.admin_audit where id = any(p_ids);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.admin_audit_delete(bigint[]) from public, anon;
grant execute on function public.admin_audit_delete(bigint[]) to authenticated;

revoke all on function public.admin_set_role(uuid, public.app_role) from public, anon;
revoke all on function public.admin_consult_start(uuid) from public, anon;
revoke all on function public.admin_consult_pull(uuid, timestamptz, text, text, integer) from public, anon;
revoke all on function public.admin_consult_end(uuid) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_consult_start(uuid) to authenticated;
grant execute on function public.admin_consult_pull(uuid, timestamptz, text, text, integer) to authenticated;
grant execute on function public.admin_consult_end(uuid) to authenticated;
