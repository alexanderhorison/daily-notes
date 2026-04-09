-- Allow single-user app mode using fixed owner id = 'app_user'.
-- Supports both legacy `clerk_user_id` and normalized `user_id` columns.

grant select, insert, update, delete on public.tasks to anon, authenticated;

do $$
declare
  owner_col text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'user_id'
  ) then
    owner_col := 'user_id';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'clerk_user_id'
  ) then
    owner_col := 'clerk_user_id';
  else
    raise exception 'tasks owner column not found (expected user_id or clerk_user_id)';
  end if;

  execute 'drop policy if exists "tasks_select_own" on public.tasks';
  execute format(
    'create policy "tasks_select_own" on public.tasks for select to anon, authenticated using (%1$I = ''app_user'' or (auth.jwt() ->> ''sub'') = %1$I)',
    owner_col
  );

  execute 'drop policy if exists "tasks_insert_own" on public.tasks';
  execute format(
    'create policy "tasks_insert_own" on public.tasks for insert to anon, authenticated with check (%1$I = ''app_user'' or (auth.jwt() ->> ''sub'') = %1$I)',
    owner_col
  );

  execute 'drop policy if exists "tasks_update_own" on public.tasks';
  execute format(
    'create policy "tasks_update_own" on public.tasks for update to anon, authenticated using (%1$I = ''app_user'' or (auth.jwt() ->> ''sub'') = %1$I) with check (%1$I = ''app_user'' or (auth.jwt() ->> ''sub'') = %1$I)',
    owner_col
  );

  execute 'drop policy if exists "tasks_delete_own" on public.tasks';
  execute format(
    'create policy "tasks_delete_own" on public.tasks for delete to anon, authenticated using (%1$I = ''app_user'' or (auth.jwt() ->> ''sub'') = %1$I)',
    owner_col
  );
end;
$$;
