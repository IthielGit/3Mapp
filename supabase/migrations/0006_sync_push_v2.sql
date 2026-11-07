-- Fundora — envoi de synchro avec version minimale du client.
-- Le 7/11/2026, une ancienne version de l'app restée en cache sur un téléphone a supprimé les catégories par
-- défaut du compte (ancienne fusion des doublons). Désormais, le client déclare sa version de synchro et le
-- serveur refuse l'envoi d'une version trop ancienne : elle ne peut plus rien écrire ni supprimer.
--
-- Ordre de déploiement : publier d'abord le client qui appelle sync_push_v2, puis appliquer cette migration.
-- L'ancienne fonction sync_push(jsonb) est supprimée : les anciens clients échouent avant tout envoi.
-- Pour bloquer une future version, augmenter min_version ci-dessous (nouvelle migration) en même temps que
-- SYNC_CLIENT_VERSION côté client (src/features/sync/sync-engine.ts).

create or replace function public.sync_push_v2(p_records jsonb, p_client_version integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  min_version constant integer := 2;
  affected integer := 0;
begin
  if not public.is_active_user() then
    raise exception 'account suspended' using errcode = '42501';
  end if;

  if p_client_version is null or p_client_version < min_version then
    raise exception 'client outdated' using errcode = 'P0001';
  end if;

  insert into public.sync_records as s (user_id, table_name, record_id, updated_at, deleted, data, changed_at)
  select
    auth.uid(),
    r->>'table_name',
    r->>'record_id',
    (r->>'updated_at')::timestamptz,
    coalesce((r->>'deleted')::boolean, false),
    case when coalesce((r->>'deleted')::boolean, false) then null else r->'data' end,
    now()
  from jsonb_array_elements(p_records) as r
  on conflict (user_id, table_name, record_id) do update
    set updated_at = excluded.updated_at,
        deleted = excluded.deleted,
        data = excluded.data,
        changed_at = now()
    where excluded.updated_at > s.updated_at;

  get diagnostics affected = row_count;

  perform public.mark_synced();
  return affected;
end;
$$;

revoke all on function public.sync_push_v2(jsonb, integer) from public, anon;
grant execute on function public.sync_push_v2(jsonb, integer) to authenticated;

-- Les anciens clients n'ont plus de point d'entrée pour écrire.
drop function if exists public.sync_push(jsonb);
