-- Switch primary key defaults to time-ordered UUIDv7 (built into PostgreSQL 18+).
-- New keys are appended at the end of the B-tree index instead of random positions.
-- Existing UUIDv4 keys stay valid; both versions share the uuid type.

alter table users alter column id set default uuidv7();
alter table creators alter column id set default uuidv7();
alter table source_accounts alter column id set default uuidv7();
alter table user_subscriptions alter column id set default uuidv7();
