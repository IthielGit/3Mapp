-- Fundora — synchronisation (plan « comptes », phase C).
-- Une ligne par enregistrement local. Les suppressions deviennent des pierres tombales (deleted = true).
-- La fusion suit « le plus récent gagne » : une écriture n'écrase une ligne serveur que si son updated_at est plus récent.

-- Un compte suspendu ne lit ni n'écrit rien (SPEC §5.14 : blocage côté serveur).
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create table public.sync_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  table_name text not null,
  record_id text not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  data jsonb,
  changed_at timestamptz not null default now(),
  primary key (user_id, table_name, record_id),
  constraint sync_records_table_known check (table_name in (
    'settings','currencies','exchangeRates','wallets','categories','subcategories',
    'transactions','templates','recurring','budgets','goals','goalTransactions',
    'debts','debtPayments','attachments','reconciliations'
  ))
);

-- Curseur de lecture : toutes les lignes modifiées après une date donnée.
create index sync_records_user_changed_idx on public.sync_records (user_id, changed_at);

alter table public.sync_records enable row level security;

create policy "sync_records: lecture de ses lignes si actif"
  on public.sync_records for select
  to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create policy "sync_records: insertion de ses lignes si actif"
  on public.sync_records for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

create policy "sync_records: mise à jour de ses lignes si actif"
  on public.sync_records for update
  to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "sync_records: suppression de ses lignes si actif"
  on public.sync_records for delete
  to authenticated
  using (user_id = auth.uid() and public.is_active_user());

-- Mise à jour de last_sync_at par une fonction dédiée : les utilisateurs n'ont pas le droit de modifier profiles.
create or replace function public.mark_synced()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_sync_at = now() where id = auth.uid();
$$;

revoke all on function public.mark_synced() from public, anon;
grant execute on function public.mark_synced() to authenticated;

-- Envoi par lots. Une ligne n'est remplacée que si la version reçue est plus récente que celle du serveur.
-- Le serveur fixe changed_at : c'est le curseur de lecture des autres appareils.
create or replace function public.sync_push(p_records jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if not public.is_active_user() then
    raise exception 'account suspended' using errcode = '42501';
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

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
