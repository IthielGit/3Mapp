-- Fundora — tests de sécurité de la base (guide « account-system », section 8.1 : S01 à S19),
-- plus consultation (C01 à C02) et journal (J01 à J03).
--
-- À exécuter dans le SQL Editor de Supabase, APRÈS avoir appliqué les migrations 0001 à 0005.
--
-- Le script crée ses propres comptes de test (adresses rls-test-*@test.local), ne lit ni ne modifie aucun
-- compte réel, joue chaque rôle en restreignant les droits comme le client le ferait, puis supprime
-- tous les comptes et entrées de journal de test, et affiche le tableau des résultats à la fin.

-- Identifiants fixes des comptes de test (A = super administrateur, B = utilisateur, C = suspendu,
-- D = compte jetable à supprimer, N = nouvel inscrit).
-- A : a0000000-0000-4000-8000-000000000001
-- B : a0000000-0000-4000-8000-000000000002
-- C : a0000000-0000-4000-8000-000000000003
-- D : a0000000-0000-4000-8000-000000000004
-- N : a0000000-0000-4000-8000-000000000005

create temp table if not exists rls_results (
  id text,
  name text,
  expected text,
  passed boolean,
  detail text
) on commit preserve rows;
truncate rls_results;

create or replace function pg_temp.as_user(uid uuid) returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $f$;

create or replace function pg_temp.as_anon() returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $f$;

create or replace function pg_temp.as_postgres() returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '', false);
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'reset role';
end $f$;

create or replace function pg_temp.log_result(p_id text, p_name text, p_expected text, p_passed boolean, p_detail text)
returns void language plpgsql as $f$
begin
  insert into rls_results values (p_id, p_name, p_expected, p_passed, p_detail);
end $f$;

-- ============================================================
-- Mise en place : comptes de test et données de test
-- ============================================================
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-test-admin@test.local', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-test-b@test.local', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-test-c@test.local', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-test-d@test.local', now(), now());

update public.profiles set role = 'super_admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.sync_records (user_id, table_name, record_id, updated_at, data) values
  ('a0000000-0000-4000-8000-000000000001', 'settings', 'settings', now(), '{"currency":"MGA"}'),
  ('a0000000-0000-4000-8000-000000000002', 'settings', 'settings', now(), '{"currency":"EUR"}'),
  ('a0000000-0000-4000-8000-000000000003', 'settings', 'settings', now(), '{}'),
  ('a0000000-0000-4000-8000-000000000004', 'settings', 'settings', now(), '{}');

-- ============================================================
-- S01 — Compte suspendu : lecture de ses propres données -> refusé (aucune ligne)
-- ============================================================
do $t$ declare n int := 0; ok boolean := false; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
    select count(*) into n from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000003';
  exception when others then n := -1;
  end;
  perform pg_temp.as_postgres();
  ok := n = 0;
  perform pg_temp.log_result('S01', 'Compte suspendu : lecture de ses données', 'refusé (vide)', ok, 'lignes visibles : ' || n);
end $t$;

-- S02 — Compte suspendu : écriture de ses données -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
    insert into public.sync_records (user_id, table_name, record_id, updated_at, data)
      values ('a0000000-0000-4000-8000-000000000003', 'settings', 'test-s02', now(), '{}');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S02', 'Compte suspendu : écriture de ses données', 'refusé', ok, msg);
end $t$;

-- S03 — Utilisateur actif : lecture des données d'un autre compte -> refusé (aucune ligne)
do $t$ declare n int := 0; ok boolean := false; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    select count(*) into n from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000001';
  exception when others then n := -1;
  end;
  perform pg_temp.as_postgres();
  ok := n = 0;
  perform pg_temp.log_result('S03', 'Utilisateur : lecture des données d''un autre compte', 'refusé (vide)', ok, 'lignes visibles : ' || n);
end $t$;

-- S04 — Utilisateur : modifier son propre statut dans profiles -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; n int := 0; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000002';
    get diagnostics n = row_count;
    msg := 'lignes modifiées : ' || n;
    ok := n = 0;
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S04', 'Utilisateur : changer son propre statut', 'refusé', ok, msg);
end $t$;

-- S05 — Utilisateur : créer un profil pour un autre identifiant -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    insert into public.profiles (id, email) values ('a0000000-0000-4000-8000-000000000099', 'rls-test-fake@test.local');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S05', 'Utilisateur : créer un profil pour un autre compte', 'refusé', ok, msg);
end $t$;

-- S06 — Utilisateur : appeler la suppression d'un compte -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    perform public.admin_delete_account('a0000000-0000-4000-8000-000000000004');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S06', 'Utilisateur : appeler admin_delete_account', 'refusé', ok, msg);
end $t$;

-- S07 — Super administrateur : lecture des données de tous les comptes, par la fonction d'administration -> autorisé
--       (lecture directe de sync_records : aucune ligne, par conception ; la lecture passe par une fonction journalisée)
do $t$ declare n int := 0; direct_n int := 0; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    select count(*) into n from public.admin_list_records('a0000000-0000-4000-8000-000000000002', 'settings', 100);
    select count(*) into direct_n from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000002';
    msg := 'via fonction : ' || n || ' ligne(s) ; lecture directe : ' || direct_n || ' (attendu : 0, par conception)';
    ok := n >= 1 and direct_n = 0;
  exception when others then ok := false; msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S07', 'Super admin : lecture des données d''un autre compte (via fonction journalisée)', 'autorisé', ok, msg);
end $t$;

-- S08 — Super administrateur : modifier la ligne d'un autre compte -> refusé (aucune ligne modifiée)
do $t$ declare n int := 0; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    update public.sync_records set data = '{"hack":1}'
      where user_id = 'a0000000-0000-4000-8000-000000000002';
    get diagnostics n = row_count;
    ok := n = 0;
    msg := 'lignes modifiées : ' || n;
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S08', 'Super admin : modifier les données d''un autre compte', 'refusé', ok, msg);
end $t$;

-- S09 — Super administrateur : ajouter une ligne pour un autre compte -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    insert into public.sync_records (user_id, table_name, record_id, updated_at, data)
      values ('a0000000-0000-4000-8000-000000000002', 'settings', 'test-s09', now(), '{}');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S09', 'Super admin : ajouter une ligne pour un autre compte', 'refusé', ok, msg);
end $t$;

-- S10 — Super administrateur : modifier ses propres données -> autorisé
do $t$ declare n int := 0; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    update public.sync_records set data = '{"currency":"MGA","touched":true}'
      where user_id = 'a0000000-0000-4000-8000-000000000001';
    get diagnostics n = row_count;
    ok := n = 1;
    msg := 'lignes modifiées : ' || n;
  exception when others then ok := false; msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S10', 'Super admin : modifier ses propres données', 'autorisé', ok, msg);
end $t$;

-- S11 — Anonyme : appeler admin_delete_account -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_anon();
    perform public.admin_delete_account('a0000000-0000-4000-8000-000000000004');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S11', 'Anonyme : appeler admin_delete_account', 'refusé', ok, msg);
end $t$;

-- S12 — Super administrateur : se supprimer soi-même -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_delete_account('a0000000-0000-4000-8000-000000000001');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S12', 'Super admin : supprimer son propre compte', 'refusé', ok, msg);
end $t$;

-- S13 — Super administrateur : supprimer un compte jetable -> autorisé ; compte, profil et données disparaissent
do $t$ declare ok boolean := false; msg text := ''; p_left int; u_left int; r_left int; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_delete_account('a0000000-0000-4000-8000-000000000004');
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  select count(*) into p_left from public.profiles where id = 'a0000000-0000-4000-8000-000000000004';
  select count(*) into u_left from auth.users where id = 'a0000000-0000-4000-8000-000000000004';
  select count(*) into r_left from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000004';
  ok := p_left = 0 and u_left = 0 and r_left = 0;
  msg := coalesce(nullif(msg, ''), '') || 'profil : ' || p_left || ', compte : ' || u_left || ', données : ' || r_left;
  perform pg_temp.log_result('S13', 'Super admin : supprimer un compte jetable', 'autorisé, tout supprimé', ok, msg);
end $t$;

-- S14 — Super administrateur suspend B : la lecture de ses propres données par B est refusée, puis B est réactivé
do $t$ declare n int := 0; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_set_status('a0000000-0000-4000-8000-000000000002', 'suspended');
    perform pg_temp.as_postgres();
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    select count(*) into n from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000002';
    perform pg_temp.as_postgres();
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_set_status('a0000000-0000-4000-8000-000000000002', 'active');
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  ok := n = 0 and msg = '';
  perform pg_temp.log_result('S14', 'Compte suspendu par l''admin : lecture refusée juste après', 'refusé (vide)', ok, 'lignes visibles : ' || n || coalesce(' ; ' || nullif(msg, ''), ''));
end $t$;

-- S15 — Nouvel inscrit : profil actif immédiatement, lecture et écriture de ses données sans validation -> autorisé
do $t$ declare status_now text; role_now text; ok boolean := false; msg text := ''; n int := 0; begin
  insert into auth.users (id, aud, role, email, created_at, updated_at)
    values ('a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'rls-test-n@test.local', now(), now());
  select status::text, role::text into status_now, role_now from public.profiles where id = 'a0000000-0000-4000-8000-000000000005';
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000005');
    insert into public.sync_records (user_id, table_name, record_id, updated_at, data)
      values ('a0000000-0000-4000-8000-000000000005', 'settings', 'settings', now(), '{}');
    select count(*) into n from public.sync_records where user_id = 'a0000000-0000-4000-8000-000000000005';
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  ok := status_now = 'active' and role_now = 'user' and n >= 1 and msg = '';
  perform pg_temp.log_result('S15', 'Nouvel inscrit : actif sans validation, lecture et écriture de ses données', 'autorisé', ok,
    'statut : ' || coalesce(status_now, '?') || ', rôle : ' || coalesce(role_now, '?') || ', lignes : ' || n || coalesce(' ; ' || nullif(msg, ''), ''));
end $t$;

-- S16 — Super administrateur : changer le rôle d'un autre compte (vers super admin, puis retour) -> autorisé
do $t$ declare role_mid text; role_end text; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000002', 'super_admin');
    perform pg_temp.as_postgres();
    select role::text into role_mid from public.profiles where id = 'a0000000-0000-4000-8000-000000000002';
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000002', 'user');
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  select role::text into role_end from public.profiles where id = 'a0000000-0000-4000-8000-000000000002';
  ok := role_mid = 'super_admin' and role_end = 'user' and msg = '';
  perform pg_temp.log_result('S16', 'Super admin : changer le rôle d''un autre compte (aller-retour)', 'autorisé', ok,
    'rôle intermédiaire : ' || coalesce(role_mid, '?') || ', final : ' || coalesce(role_end, '?') || coalesce(' ; ' || nullif(msg, ''), ''));
end $t$;

-- S17 — Super administrateur : changer son propre rôle ou statut -> refusé (trois tentatives)
-- Chaque tentative réétablit l'identité juste avant (une erreur annule le « set role » du bloc précédent).
-- Le détail indique l'identité réellement active, pour que chaque refus soit prouvé pour la bonne raison.
do $t$ declare ok1 boolean := false; ok2 boolean := false; ok3 boolean := false; msg text := ''; n int := 0; who1 text; who2 text; who3 text; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    who1 := coalesce(auth.uid()::text, 'aucune');
    update public.profiles set role = 'user' where id = 'a0000000-0000-4000-8000-000000000001';
    get diagnostics n = row_count;
    ok1 := n = 0;
  exception when others then ok1 := true;
  end;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    who2 := coalesce(auth.uid()::text, 'aucune');
    perform public.admin_set_status('a0000000-0000-4000-8000-000000000001', 'suspended');
  exception when others then ok2 := true; msg := sqlerrm;
  end;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    who3 := coalesce(auth.uid()::text, 'aucune');
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000001', 'user');
  exception when others then ok3 := true;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S17', 'Super admin : changer son propre rôle ou statut', 'refusé (3 tentatives)', ok1 and ok2 and ok3,
    'identité : ' || who1 || '/' || who2 || '/' || who3 || ' ; modification directe : ' || ok1 || ', statut : ' || ok2 || ', rôle : ' || ok3 || ' ; ' || msg);
end $t$;

-- S18 — Dernier super administrateur actif : ne peut pas être rétrogradé
--       Note : la règle « pas de modification de son propre rôle » couvre ce cas, car celui qui agit est lui-même
--       un super administrateur actif. Le test vérifie donc la tentative de rétrogradation de soi-même.
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000001', 'user');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S18', 'Dernier super admin : rétrogradation refusée', 'refusé', ok, msg);
end $t$;

-- S19 — Utilisateur : se donner le rôle super administrateur -> refusé (deux voies)
do $t$ declare ok1 boolean := false; ok2 boolean := false; n int := 0; msg text := ''; who1 text; who2 text; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    who1 := coalesce(auth.uid()::text, 'aucune');
    update public.profiles set role = 'super_admin' where id = 'a0000000-0000-4000-8000-000000000002';
    get diagnostics n = row_count;
    ok1 := n = 0;
  exception when others then ok1 := true;
  end;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    who2 := coalesce(auth.uid()::text, 'aucune');
    perform public.admin_set_role('a0000000-0000-4000-8000-000000000002', 'super_admin');
  exception when others then ok2 := true; msg := sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('S19', 'Utilisateur : se donner le rôle super administrateur', 'refusé (2 voies)', ok1 and ok2,
    'identité : ' || who1 || '/' || who2 || ' ; modification directe : ' || ok1 || ', fonction : ' || ok2 || ' ; ' || msg);
end $t$;

-- ============================================================
-- Consultation (lecture seule) et journal
-- ============================================================

-- C01 — Super admin : ouvrir une consultation sur B et lire ses données -> autorisé
do $t$ declare email_seen text; n int := 0; ok boolean := false; msg text := ''; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    email_seen := public.admin_consult_start('a0000000-0000-4000-8000-000000000002');
    select count(*) into n from public.admin_consult_pull('a0000000-0000-4000-8000-000000000002', null, '', '', 500);
    perform public.admin_consult_end('a0000000-0000-4000-8000-000000000002');
    ok := email_seen = 'rls-test-b@test.local' and n >= 1;
    msg := 'e-mail : ' || coalesce(email_seen, '?') || ', lignes : ' || n;
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('C01', 'Super admin : consultation de B (lecture seule, journalisée)', 'autorisé', ok, msg);
end $t$;

-- C02 — Super admin : ouvrir une consultation sur soi-même -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    perform public.admin_consult_start('a0000000-0000-4000-8000-000000000001');
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('C02', 'Super admin : consulter son propre compte', 'refusé', ok, msg);
end $t$;

-- C03 — Utilisateur : lire la consultation d'un autre compte -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    perform count(*) from public.admin_consult_pull('a0000000-0000-4000-8000-000000000001', null, '', '', 500);
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('C03', 'Utilisateur : lire les données d''un autre compte en consultation', 'refusé', ok, msg);
end $t$;

-- J01 — Utilisateur : lire le journal, ou le modifier directement -> refusé
do $t$ declare ok1 boolean := false; ok2 boolean := false; ok3 boolean := false; who text; begin
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    who := coalesce(auth.uid()::text, 'aucune');
    perform count(*) from public.admin_audit_list(10);
  exception when others then ok1 := true;
  end;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    perform count(*) from public.admin_audit;
  exception when others then ok2 := true;
  end;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
    perform public.admin_audit_delete(array[1::bigint]);
  exception when others then ok3 := true;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('J01', 'Utilisateur : lire ou effacer le journal', 'refusé (3 voies)', ok1 and ok2 and ok3,
    'identité : ' || who || ' ; liste : ' || ok1 || ', table : ' || ok2 || ', effacement : ' || ok3);
end $t$;

-- J02 — Super admin : effacer une entrée du journal -> autorisé ; l'entrée disparaît
do $t$ declare target_id bigint; before_n int := 0; after_n int := 0; removed int := 0; ok boolean := false; msg text := ''; begin
  perform pg_temp.as_postgres();
  select count(*) into before_n from public.admin_audit where target_email = 'rls-test-b@test.local';
  select id into target_id from public.admin_audit where target_email = 'rls-test-b@test.local' order by id limit 1;
  begin
    perform pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
    removed := public.admin_audit_delete(array[target_id]);
  exception when others then msg := 'erreur : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  select count(*) into after_n from public.admin_audit where target_email = 'rls-test-b@test.local';
  ok := removed = 1 and after_n = before_n - 1 and msg = '';
  perform pg_temp.log_result('J02', 'Super admin : effacer une entrée du journal', 'autorisé, entrée supprimée', ok,
    'supprimées : ' || removed || ', avant : ' || before_n || ', après : ' || after_n || coalesce(' ; ' || nullif(msg, ''), ''));
end $t$;

-- J03 — Anonyme : lire le journal -> refusé
do $t$ declare ok boolean := false; msg text := 'aucune erreur'; begin
  begin
    perform pg_temp.as_anon();
    perform count(*) from public.admin_audit_list(10);
  exception when others then ok := true; msg := 'refusé : ' || sqlerrm;
  end;
  perform pg_temp.as_postgres();
  perform pg_temp.log_result('J03', 'Anonyme : lire le journal', 'refusé', ok, msg);
end $t$;

-- ============================================================
-- Nettoyage : suppression de tous les comptes et entrées de test (cascade vers profils et données)
-- ============================================================
delete from public.admin_audit where target_email like 'rls-test-%' or admin_id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005');
delete from auth.users where email like 'rls-test-%@test.local';

-- ============================================================
-- Résultats
-- ============================================================
-- Une seule requête finale : l'éditeur Supabase n'affiche que le dernier résultat.
-- La dernière ligne est le bilan (id « ZZ-BILAN »).
select id, name, expected,
       case when passed then 'OK' else 'ÉCHEC' end as resultat,
       detail
from rls_results
union all
select 'ZZ-BILAN',
       'Bilan',
       count(*)::text || ' tests',
       case when count(*) filter (where not passed) = 0 then 'OK' else 'ÉCHEC' end,
       'réussis : ' || count(*) filter (where passed) || ' ; échecs : ' || count(*) filter (where not passed)
from rls_results
order by 1;
