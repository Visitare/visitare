# db/tests

Local, ad-hoc verification for individual migrations against a throwaway
Postgres instance. Not a general test runner — one stub + one test file per
migration that needs it, added when the migration warrants proof beyond
reading the SQL.

## Why a stub instead of replaying `supabase/migrations/` from scratch

Since the Supabase CLI landed (VISI-11), `supabase db reset` *can* replay the
whole chain: `20260524000000_000_base_schema.sql` creates the English-named
tables that used to exist only in the production database, which closed
VISI-40. The stub stays because a single-migration test needs neither the full
schema nor the CLI — `stub_supabase_runtime.sql` and
`stub_schema_as_of_013.sql` rebuild only the roles/tables/policies the test
touches, on a throwaway Postgres, in seconds. If the base schema drifts far
enough that the stub stops reflecting reality, prefer `supabase db reset`.

## Running `017_allocations_engine_guard_test.sql`

```bash
docker run -d --rm --name visitare_test_pg -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:17-alpine
createdb -h 127.0.0.1 -p 5434 -U postgres visitare_test   # PGPASSWORD=postgres

psql -h 127.0.0.1 -p 5434 -U postgres -d visitare_test -v ON_ERROR_STOP=1 -f db/tests/stub_supabase_runtime.sql
psql -h 127.0.0.1 -p 5434 -U postgres -d visitare_test -v ON_ERROR_STOP=1 -f db/tests/stub_schema_as_of_013.sql
psql -h 127.0.0.1 -p 5434 -U postgres -d visitare_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260831150200_017_allocations_engine_guard.sql
psql -h 127.0.0.1 -p 5434 -U postgres -d visitare_test -v ON_ERROR_STOP=1 -f db/tests/017_allocations_engine_guard_test.sql

docker stop visitare_test_pg
```

Everything the test file does runs inside one `BEGIN; ... ROLLBACK;` block, so
it leaves no fixture data behind — safe to re-run.
