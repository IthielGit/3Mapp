-- Fundora — suppression de son propre compte (RGPD, plan « comptes », phase F).
-- L'utilisateur connecté supprime son compte : la ligne auth.users disparaît, et le profil
-- ainsi que toutes les lignes sync_records partent par cascade. Aucun paramètre : on ne peut supprimer que soi-même.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
