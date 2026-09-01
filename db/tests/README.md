# db/tests

Local, ad-hoc verification for individual migrations against a throwaway
Postgres instance. Not a general test runner — one test file per migration that
warrants proof beyond reading the SQL.

## How it runs

Since the Supabase CLI landed (VISI-11), the whole chain replays from scratch,
so the tests run against the **real** schema — no hand-written stub of the
tables. The only stub left is `stub_supabase_runtime.sql`, which provides what
a bare Postgres lacks and Supabase provisions for you: the
`anon`/`authenticated`/`service_role` roles, `schema auth` with `auth.jwt()`,
and the `supabase_realtime` publication.

A hand-written schema stub used to stand in for the chain. It was deleted
because it drifted: it had `teams.latitude` nullable, `captured_visits.profile_blocks`
as `jsonb` instead of `text[]`, and pre-014 grants — so tests passed against it
while failing against a real database.

## Running the tests

```bash
docker run -d --rm --name visitare_test_pg -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:17-alpine
createdb -h 127.0.0.1 -p 5434 -U postgres visitare_test   # PGPASSWORD=postgres

PSQL="psql -h 127.0.0.1 -p 5434 -U postgres -d visitare_test -v ON_ERROR_STOP=1"

# 1. Supabase runtime, then the real chain in filename order
$PSQL -f db/tests/stub_supabase_runtime.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done

# 2. the tests
$PSQL -f db/tests/017_allocations_engine_guard_test.sql

docker stop visitare_test_pg
```

`016_current_week_start_test.sql` is self-contained — it bootstraps its own
roles and applies its migration via `\ir`, so it runs on an empty database:

```bash
$PSQL -f db/tests/016_current_week_start_test.sql
```

Every test file wraps its assertions in `BEGIN; ... ROLLBACK;`, so it leaves no
fixture data behind — safe to re-run.
