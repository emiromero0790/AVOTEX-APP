alter table public.tasks
add column if not exists scheduled_at timestamp with time zone;

update public.tasks
set scheduled_at = case
  when detail ~ '^\[avotex-date:\d{4}-\d{2}-\d{2}\]'
    then (
      substring(detail from '^\[avotex-date:(\d{4}-\d{2}-\d{2})\]') ||
      ' 12:00:00-06'
    )::timestamp with time zone
  else coalesce(created_at, now())
end
where scheduled_at is null;

alter table public.tasks
alter column scheduled_at set default now(),
alter column scheduled_at set not null;

create index if not exists tasks_user_scheduled_at_idx
on public.tasks (user_id, scheduled_at);

comment on column public.tasks.scheduled_at is
  'Fecha y hora programadas para mostrar la tarea en el calendario de Avotex.';