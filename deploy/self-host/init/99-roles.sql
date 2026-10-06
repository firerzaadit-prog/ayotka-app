-- Disalin dari paket resmi Supabase (docker/volumes/db/roles.sql): memberi kata sandi (= POSTGRES_PASSWORD) pada role
-- internal yang dipakai GoTrue. Dijalankan otomatis hanya pada inisialisasi pertama folder data.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
