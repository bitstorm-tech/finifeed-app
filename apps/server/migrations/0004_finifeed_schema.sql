-- Move application tables from public into the dedicated finifeed schema (created by the migration runner).
-- Databases set up after this change already create them there; only legacy tables in public are moved.
-- Indexes, constraints and foreign keys move with their tables.

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'creators', 'source_accounts', 'user_subscriptions'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I set schema finifeed', table_name);
    end if;
  end loop;
end
$$;
