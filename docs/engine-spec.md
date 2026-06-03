# PRIO-ACS Engine — Architecture Spec

> Version: 0.1 — 2026-05-28
> Purpose: reference for math analysis and implementation planning
> Scope: allocation engine behavior, data contracts, app integration

---

## 1. What the engine is

The PRIO-ACS engine is a **batch allocation service**. It is not a per-request API.

Given a clinic and a time period, it:
1. Scores every patient registered to that clinic using the PRIO-ACS formula
2. Distributes patients across the clinic's ACS agents with balanced workload
3. Orders each agent's list by visit priority
4. Writes the result to Supabase as a flat allocation table

The app never calls the engine. The engine runs on a schedule and the app reads its output.

> **v1 scope (grill 2026-06-03):** the patient→ACS link is **fixed by the registry
> microárea** — each ACS owns a fixed micro-territory (~150 families); the engine does
> **not** reassign patients across ACS. So for the **pilot**, the engine does steps **1, 3,
> 4 only** (score → order each ACS's own list). **Step 2 (distribute across ACS) and all of
> §5 — balancing, geo clustering, capacity — are `[ROADMAP]`** (needed only for coverage
> edge cases: ACS on leave, patient with no microárea). See `architecture.md §0`/§12.

---

## 2. Trigger and schedule

The engine wakes up on a cron schedule. Frequency is configured **per clinic** in a YAML file — there is no global schedule.

| Mode | Trigger | Typical use |
|------|---------|-------------|
| `daily` | Every morning (e.g. 06:00 local time) | High-turnover clinics, urban |
| `weekly` | Monday morning | Stable caseloads, rural |
| `on_demand` | Manual API call | Testing, emergency reallocation |

When triggered, the engine processes **all clinics** that are due for a new allocation in that run. Each clinic is independent.

---

## 3. Inputs — what the engine reads from Supabase

All reads use the `service_role` key. The engine reads four tables:

### 3.1 `pacientes`
One row per patient registered to the clinic.

| Field | Type | Used for |
|-------|------|----------|
| `paciente_id` | text | identity |
| `equipe_id` | text | clinic filter |
| `hipertenso` | bool | C1 ICSAP score |
| `diabetico` | bool | C1 ICSAP score |
| `gestacao` | bool | C1 ICSAP + C2 life-stage |
| `situacao_vulnerabilidade` | bool | C4 social score |
| `faixa_etaria` | text | C2 life-stage |
| `endereco_latitude` | float | geo clustering |
| `endereco_longitude` | float | geo clustering |

### 3.2 `visitas` + `visitas_capturadas`
Used to compute days since last visit (gap component of C3).

- `visitas`: official records from Vitacare
- `visitas_capturadas`: field captures by ACS via the app

The engine takes `MAX(registrados_em, capturado_em)` per patient — whichever is more recent counts. This prevents a patient from staying in alert state after an ACS visited them but Vitacare hasn't synced yet.

### 3.3 `eventos`
Clinical events (urgency visits, hospitalizations, scheduled appointments).

| Field | Type | Used for |
|-------|------|----------|
| `paciente_id` | text | join |
| `tipo` | text | filter: non-elective only |
| `data_referencia` | date | C3 event window (60 days) |

Only events of type `urgencia-emergencia-ou-internacao` trigger the C3 event component.

### 3.4 `equipes`
Roster of ACS agents per clinic.

| Field | Type | Used for |
|-------|------|----------|
| `equipe_id` | text | clinic identity |
| `profissional_id` | text | ACS identity |
| `lat` | float | ACS home/clinic location (geo) |
| `lng` | float | ACS home/clinic location (geo) |

Currently `lat/lng` represent the clinic coordinates. Future: real-time ACS location.

---

## 4. Scoring — PRIO-ACS formula

Each patient receives a score 0–100 composed of four independent components.

```
PRIO_ACS(p) = C1(p) + C2(p) + C3(p) + C4(p)
```

### C1 — ICSAP Proxy (0–35, capped)
```
C1 = min(35, 15·hipertenso + 15·diabetico + 15·gestacao)
```
Captures risk of preventable hospitalization (Portaria SAS/MS 221/2008 groups 9, 13, 19).
Cap at 35 prevents multimorbidity from consuming the full score budget.

### C2 — Vulnerable Life-Stage (0–25, max of conditions)
```
C2 = max(
  25  if gestacao,
  20  if faixa_etaria == "0-6",
  15  if faixa_etaria == "66+" AND (hipertenso OR diabetico),
  0
)
```
Uses `max()` not `sum()` — the weights already represent the full impact of that life stage. Stacking would distort the budget.

### C3 — Care Gap / Urgency (0–25, sum)
```
gap_limit = 30   if gestante
            45   if faixa_etaria == "0-6"
            90   if hipertenso OR diabetico
            180  otherwise

C3 = min(25,
  15 · (non_elective_events_last_60d > 0)
  + 10 · (days_since_last_visit > gap_limit)
)
```
Uses `sum()` — event + gap exceeded together represent the worst possible care failure.
The 60-day event window is calibrated to the dataset noise characteristics and the ACS weekly planning cycle.

### C4 — Social Vulnerability (0–15, binary)
```
C4 = 15 · situacao_vulnerabilidade
```
Functions as a tiebreaker between patients with similar clinical profiles. Deliberately weighted below clinical components — SDOH predicts long-horizon risk, not same-day urgency.

### Tier classification
```
score 0–30   → Habitual  (monthly cadence)
score 31–60  → Médio     (biweekly to monthly)
score 61–100 → Alto      (weekly to biweekly)
```

---

## 5. Allocation — distributing patients across ACS

> **`[ROADMAP]` — not in the pilot.** In v1 the patient→ACS assignment comes **fixed from
> the registry** (microárea), not computed here. The engine only **orders** each ACS's
> already-fixed list (see §5.4, which stays `[V1]`). §5.1 balancing, §5.2 geo clustering,
> §5.3 capacity/overflow are roadmap for coverage edge cases. `/to-prd`: build §5.4 only.

After scoring all patients, the engine assigns each patient to one ACS and orders that ACS's list.

This is a **constrained assignment problem** with three objectives:

### 5.1 Workload balancing
No ACS should receive a disproportionate share of `Alto` patients.

Current approach: sort patients by tier descending (Alto first), then assign in round-robin across ACS agents. This distributes critical patients evenly before filling remaining capacity with `Médio` and `Habitual`.

Open question: should the balancing be by count of `Alto` patients, or by total score sum? Count is simpler to audit; sum is more precise but less legible to supervisors.

### 5.2 Geographic clustering
Patients near each other should go to the same ACS to minimize travel.

Current approach: after round-robin assignment of `Alto` patients, remaining patients are assigned to the nearest ACS by Euclidean distance from the ACS home/clinic coordinates.

Known limitation: Euclidean distance is a poor proxy in favela terrain where roads don't follow straight lines. Future: road network distance via OSRM or Google Maps API.

### 5.3 Capacity constraint
Each ACS has a maximum patient count per period, set in the clinic YAML (`patient_cap`).

Patients that cannot be assigned within capacity limits are marked `status: 'overflow'` and flagged for supervisor review — they are not silently dropped.

### 5.4 Priority ordering within each ACS list  `[V1]`
> This is the only part of §5 that runs in the pilot: order each ACS's fixed list by tier
> then score. The nearest-neighbor route step (3) is optional polish for v1.
Once patients are assigned to an ACS, the list is ordered by:
1. `tier` descending (Alto before Médio before Habitual)
2. `score` descending within tier
3. Geographic proximity to previous patient (basic route efficiency — nearest-neighbor)

The geographic ordering is applied only within the same tier to avoid routing a Habitual patient before an Alto one.

---

## 6. Outputs — what the engine writes to Supabase

The engine writes one row per patient-ACS assignment to the `allocations` table.

```sql
allocations (
  id              uuid,
  clinic_id       text,
  acs_id          text,
  paciente_id     text,
  period_start    date,
  period_mode     text,       -- 'daily' | 'weekly'
  priority_order  int,        -- position in this ACS's list
  score           int,
  score_icsap     int,
  score_life_stage int,
  score_care_gap  int,
  score_social    int,
  tier            text,
  motivo          text,
  status          text,       -- 'pending' | 'visited' | 'skipped' | 'overflow' | 'dropped'
  origin          text,       -- 'engine' | 'gestor' | 'acs'  (who created/owns this row)
  allocated_at    timestamptz
)
-- index on (paciente_id, period_start) → "which list is this person on right now?"
```

The `origin` field makes the list **editable by humans without the engine fighting
back**. The engine generates the list, but it is guidance, not a mandate: a gestor
can reassign/add/remove patients, and in the future an ACS can add a clinic-linked
patient on the fly (searched by name, or name + birthdate, because they happen to be
passing the house). Whoever created the row owns it.

### Upsert behavior
When the engine re-runs for a period already in progress:
- Rows with `origin in ('gestor','acs')` are **preserved untouched** — the engine
  never moves, re-scores, or drops a human-created/edited assignment.
- Rows with `status = 'visited'` or `status = 'skipped'` are **preserved unchanged**
  (any origin).
- Rows with `origin = 'engine'` and `status = 'pending'` are **recalculated** (score
  or assignment may change).
- New patients that became urgent mid-period are **inserted** with
  `origin = 'engine'`, `status = 'pending'`.
- Engine-origin patients that dropped below threshold are marked `status = 'dropped'`
  — never deleted, and only ever for `origin = 'engine'` rows.

This guarantees two invariants: the ACS never loses progress when the engine re-runs,
and **human decisions are sovereign over the engine's suggestions**. The backend can
always answer "which list is this person on?" via the `(paciente_id, period_start)`
index, regardless of who created the entry.

---

## 7. App behavior

### On period start
```js
supabase
  .from('allocations')
  .select('*, pacientes(*)')
  .eq('acs_id', currentAcsId)
  .eq('period_start', currentPeriodStart)
  .neq('status', 'overflow')
  .order('priority_order')
```
Result is cached locally (Dexie / AsyncStorage). No further fetches needed during the period.

### During the period
ACS works through the list top-to-bottom. After each visit:
```js
supabase
  .from('allocations')
  .update({ status: 'visited' })
  .eq('id', allocationId)
```
This is the only write the app makes to `allocations`.

Form data from the visit is written separately to `visitas_capturadas` — the allocation record and the visit record are decoupled.

### Mid-period engine re-run
If the engine re-runs while the ACS is working, new urgent patients may appear at the top of the list. The app detects this via Supabase Realtime:
```js
supabase
  .channel('allocations')
  .on('postgres_changes', { event: 'INSERT', table: 'allocations' }, handleNewPatient)
  .subscribe()
```
Visited patients are unaffected.

---

## 8. Configuration (per clinic YAML)

```yaml
# config/rio-de-janeiro.yaml

clinic_defaults:
  mode: weekly              # 'daily' | 'weekly'
  patient_cap: 50           # max patients per ACS per period

scoring:
  icsap_weights:
    hipertenso: 15
    diabetico: 15
    gestacao: 15
    cap: 35
  life_stage_weights:
    gestante: 25
    crianca_0_6: 20
    idoso_cronico: 15
  care_gap:
    evento_weight: 15
    gap_weight: 10
    evento_janela_dias: 60
    gap_limits:
      gestante: 30
      crianca_0_6: 45
      cronico: 90
      geral: 180
  social_weight: 15
  tier_cuts:
    medio: 31
    alto: 61

allocation:
  balancing: round_robin    # 'round_robin' | 'score_sum' (open question)
  geo_clustering: euclidean # 'euclidean' | 'road_network' (future)
  route_ordering: true      # nearest-neighbor within tier
```

Each municipality gets its own YAML. Weights, cuts, and limits are all configurable without code changes.

---

## 9. Known limitations and open questions for math review

| # | Issue | Current behavior | Question |
|---|-------|-----------------|----------|
| 1 | C3 event component is binary | 1 ER visit = 3 ER visits in score | Should repeated urgency visits add weight? Cap at what? (Caso 20 — porta giratória) |
| 2 | C2 uses `max()` | Gestante idosa gets 25, not 40 | Is there a combination where stacking C2 categories is clinically justified? |
| 3 | C4 is binary | Vulnerabilidade = 15 or 0 | IDS-Rio (continuous 0-1) would replace this — what should the new weight range be? |
| 4 | Gap limit hierarchy is fixed | Gestante always gets 30d regardless of other factors | Should a gestante diabética have a shorter limit than a gestante saudável? |
| 5 | Workload balancing metric | Round-robin by Alto count | Is count the right metric or should we balance by total score sum? |
| 6 | Geo distance metric | Euclidean | What's the error margin in favela terrain vs road network? |
| 7 | Puerpério not captured | Post-partum patient scores 0 after delivery | Flag needed: `puerperio_dias_pos_parto < 42` → treat as gestante in C1/C2 |
| 8 | 60-day event window | Calibrated to dataset noise | Should this vary by event type? (ER visit vs hospitalization vs ambulatory) |
| 9 | Cap interaction between C1 and C3 | Independent caps (35 + 25) | Is there a theoretical argument for a global cap below 100? |
| 10 | Score ties | Broken by geographic proximity | Should vulnerability (C4) or tier history be a tiebreaker instead? |
