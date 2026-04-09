do $$
declare
  legacy_user_id_column text;
begin
  select c.column_name
  into legacy_user_id_column
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'tasks'
    and c.column_name <> 'user_id'
    and c.column_name like '%\_user\_id' escape '\'
  order by c.ordinal_position
  limit 1;

  if legacy_user_id_column is not null then
    execute format('alter table public.tasks rename column %I to user_id', legacy_user_id_column);
  end if;
end;
$$;

create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed);

grant select, insert, update, delete on public.tasks to anon, authenticated;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks
for select
to anon, authenticated
using (
  user_id = 'app_user'
  or (auth.jwt() ->> 'sub') = user_id
);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks
for insert
to anon, authenticated
with check (
  user_id = 'app_user'
  or (auth.jwt() ->> 'sub') = user_id
);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks
for update
to anon, authenticated
using (
  user_id = 'app_user'
  or (auth.jwt() ->> 'sub') = user_id
)
with check (
  user_id = 'app_user'
  or (auth.jwt() ->> 'sub') = user_id
);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks
for delete
to anon, authenticated
using (
  user_id = 'app_user'
  or (auth.jwt() ->> 'sub') = user_id
);
