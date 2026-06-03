# Visitare — Master TODO

> Last updated: 2026-05-28
> Stack: Astro (LP) · React PWA · Expo (mobile) · FastAPI (engine) · Supabase (DB)

---

## 0. Supabase — blocker for everything

- [ ] Create new Supabase project (`visitare`)
- [ ] Run migrations in order: `db/migrations/001` → `005`
- [ ] Write parquet loader script (`scripts/load_parquets.py`) to seed `pacientes`, `visitas`, `eventos`, `equipes`
- [ ] Create `allocations` table (see schema below)
- [ ] Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel (fixes PWA crash)
- [ ] Store `service_role` key securely (engine only — never in frontend)

### Allocations table schema
```sql
allocations (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       text,
  acs_id          text,
  paciente_id     text,
  period_start    date,           -- start of day or week this covers
  period_mode     text,           -- 'daily' | 'weekly' (from clinic yaml)
  priority_order  int,            -- 1,2,3... within this ACS's list
  score           int,            -- PRIO-ACS score at allocation time
  tier            text,           -- 'alto' | 'medio' | 'habitual'
  motivo          text,           -- human-readable reason
  status          text default 'pending',  -- 'pending' | 'visited' | 'skipped' | 'overflow' | 'dropped'
  origin          text default 'engine',   -- 'engine' | 'gestor' | 'acs' (who owns the row)
  allocated_at    timestamptz default now()
)
-- index (paciente_id, period_start) → lookup "which list is this person on?"
```

> `origin` lets gestor/ACS edit the list without the engine overwriting them on
> re-run. Engine only touches `origin = 'engine'` rows. See `docs/architecture.md §8.1`
> and `docs/engine-spec.md §6`.

---

## 1. Monorepo restructure (visitare/)

- [ ] Rename `frontend/` → `app/`
- [ ] Update `.vercel/project.json` inside `app/`
- [ ] Update root `.gitignore`
- [ ] Create `site/` folder (Astro)
- [ ] Create `mobile/` folder (Expo)

Final structure:
```
visitare/
├── site/      # Astro LP → visitare.app + www
├── app/       # React PWA → acs.visitare.app
├── mobile/    # Expo → App Store / Play Store
├── db/        # Supabase migrations
├── data/      # parquets (hackathon only, removed in prod)
└── scripts/   # loader, utilities
```

---

## 2. DNS — GoDaddy (one record missing)

- [ ] Add CNAME `acs` → `cname.vercel-dns.com` in GoDaddy
- [ ] Add `acs.visitare.app` domain to the React PWA Vercel project
- [ ] Remove `visitare.app` + `www.visitare.app` from React project (reassign to Astro)

---

## 3. Astro landing page (`site/`)

- [ ] Scaffold Astro project (`npm create astro@latest site`)
- [ ] Port LP design from `acs-digital.vercel.app` (use as visual reference)
- [ ] Create second Vercel project → root dir `site/`
- [ ] Wire `visitare.app` + `www.visitare.app` to Astro Vercel project
- [ ] CTA button → links to `acs.visitare.app`

---

## 4. React PWA (`app/`)

- [ ] Fix Supabase crash — set env vars in Vercel
- [ ] Verify app works end-to-end with new Supabase project
- [ ] Update app to read from `allocations` table instead of calling `priorizacao_pacientes` RPC directly
  - fetch: `eq('acs_id', myId).eq('period_start', currentPeriod).order('priority_order')`
- [ ] Add status update: mark patient as visited → `status = 'visited'`
- [ ] PWA install prompt + offline smoke test

---

## 5. Expo mobile (`mobile/`)

- [ ] Scaffold Expo project (`npx create-expo-app mobile`)
- [ ] Install: `@supabase/supabase-js`, `nativewind`, `expo-location`
- [ ] Supabase client config (same project, same anon key)
- [ ] Build screens mirroring the PWA:
  - [ ] `ListaScreen` — reads `allocations`, ordered by `priority_order`
  - [ ] `PacienteScreen` — patient detail + score decomposition
  - [ ] `VisitaScreen` — form submission → `visitas_capturadas`
  - [ ] `SelecionarACSScreen`
  - [ ] `SupervisorScreen`
- [ ] Mark visited: update `allocations.status = 'visited'`
- [ ] AsyncStorage offline queue for form submissions
- [ ] EAS Build config (`eas.json`) for iOS + Android
- [ ] Apple Developer + Google Play accounts
- [ ] TestFlight / internal track for first build

---

## 6. PRIO-ACS Engine (private repo: `rafaelbressan/prio-acs-engine`)

### Setup
- [ ] `gh repo create rafaelbressan/prio-acs-engine --private`
- [ ] Scaffold FastAPI project structure:
```
prio-acs-engine/
├── main.py
├── engine/
│   ├── score.py          # compute_prio_acs() — extracted from scripts/
│   ├── allocator.py      # distribution + balancing logic
│   └── geo.py            # distance / clustering utils
├── config/
│   └── rio-de-janeiro.yaml
├── jobs/
│   └── scheduler.py      # cron runner
├── Dockerfile
└── requirements.txt
```

### Scoring (`engine/score.py`)
- [ ] Extract `compute_prio_acs()` from `scripts/gerar_lista_do_dia.py`
- [ ] Unit tests for all 25 canonical cases from PRIO-ACS v1.2 doc

### Allocation (`engine/allocator.py`)
- [ ] Read all patients for a clinic from Supabase (service_role key)
- [ ] Score every patient
- [ ] Distribute across ACS:
  - [ ] Balance `alto` tier patients — no ACS gets disproportionate share of critical
  - [ ] Geographic clustering — group nearby patients per ACS (lat/lon proximity)
  - [ ] Respect `patient_cap` per ACS (from clinic yaml)
- [ ] Order each ACS list by `priority_order` (score + route efficiency)
- [ ] Upsert logic on write:
  - preserve `status = 'visited'` across re-runs — never overwrite completed visits
  - insert new urgent patients that appeared mid-period
  - mark dropped patients as `status = 'dropped'` (don't delete — preserve history)

### Config (`config/rio-de-janeiro.yaml`)
```yaml
clinic_defaults:
  mode: weekly          # 'daily' | 'weekly'
  patient_cap: 50       # max patients per ACS per period
  icsap_weights:
    hipertenso: 15
    diabetico: 15
    gestacao: 15
    cap: 35
  life_stage_weights:
    gestante: 25
    crianca_0_6: 20
    idoso_cronico: 15
  care_gap_weights:
    evento_recente: 15
    gap_excedido: 10
  social_weight: 15
  tier_cuts:
    medio: 31
    alto: 61
  gap_limits:
    gestante: 30
    crianca_0_6: 45
    cronico: 90
    geral: 180
    evento_janela_dias: 60
```

### Scheduler (`jobs/scheduler.py`)
- [ ] Cron job reads all active clinics from Supabase
- [ ] For each clinic: check `mode` from yaml → run daily or weekly
- [ ] Trigger allocation → write results to `allocations` table
- [ ] Log run metadata (clinic, patients scored, ACS count, duration)

### API endpoints (FastAPI)
- [ ] `POST /allocate/{clinic_id}` — manual trigger (for testing / on-demand)
- [ ] `GET /config/{municipio}` — inspect active config
- [ ] `GET /health` — liveness check

### Deploy
- [ ] Dockerfile
- [ ] Deploy to Railway (or Fly.io)
- [ ] Set env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configure Railway cron to trigger scheduler

---

## 7. Sync job — Vitacare ↔ Supabase (future, when API access granted)

- [ ] `pull_from_vitacare()` — fetch patients, visits, events → upsert Supabase
- [ ] `push_to_vitacare()` — flush `visitas_capturadas` → Vitacare API
- [ ] Schedule: cron every 15 min (or webhook if Vitacare supports it)
- [ ] Can live in `prio-acs-engine/jobs/` as a separate module
- [ ] Remove parquet loader once Vitacare sync is live

---

## 8. Later / v2

- [ ] **Geo C5 component** — distance from clinic as optional score factor (config-gated)
- [ ] **Real-time ACS location** — collect current ACS position for live routing optimization
- [ ] **IDS-Rio** — replace binary `situacao_vulnerabilidade` with continuous 0-1 index by census sector
- [ ] **Repeat urgency flag** — `C3` currently binary; count multiple ER visits (porta giratória pattern, Caso 20)
- [ ] **Puerpério flag** — post-partum within 42 days, currently a known failure mode (Caso 15)
- [ ] **ML overlay** — score v2 with gradient boosting on top of deterministic base
- [ ] **Multi-municipality** — second yaml, onboarding flow for new city configs
- [ ] **Vitacare integration** — push scores and allocations back to official system
- [ ] **Supervisor dashboard** — web view of team coverage, critical alerts, Previne Brasil indicators

---

## Data flow reference

```
Vitacare API
     ↕  sync job (cron, future)
  Supabase
     ├── pacientes, visitas, eventos  ← source of truth
     ├── visitas_capturadas           ← ACS field captures (app writes here)
     └── allocations                  ← engine writes here, app reads here

PRIO-ACS Engine (FastAPI, runs on cron per clinic config)
     reads → Supabase (service_role)
     writes → allocations table

App / PWA / Expo (reads Supabase directly)
     reads  → allocations (my list for this period)
     writes → visitas_capturadas (form submissions)
              allocations.status (mark visited)
```
