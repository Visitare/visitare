// Adapter entre o schema do Supabase (inglês, vindo do engine via `allocations`)
// e o tipo `Paciente` que o resto do app já consome. Mantém a interface estável;
// só a fonte muda — agora é a lista semanal do ACS (engine SSOT, ADR 0001).

import type { Condicao, FaixaEtaria, Paciente, Prioridade, RacaCor } from '../types'
import { REF_DATE, supabase } from './supabase'

// --------------------------------------------------------------------------
// Shape vindo da RPC acs_week_list (allocations JOIN patients) — inglês
// --------------------------------------------------------------------------

interface AcsWeekRow {
  patient_id: string
  team_id: string
  age_band: string
  sex: string
  race_color: string | null
  social_vulnerability: boolean
  latitude: number
  longitude: number
  hypertensive: boolean
  diabetic: boolean
  pregnant: boolean
  priority_order: number
  score: number
  score_icsap: number
  score_life_stage: number
  score_care_gap: number
  score_social: number
  tier: 'high' | 'medium' | 'routine'
  reason: string
  status: string
  last_visit: string | null
}

// --------------------------------------------------------------------------
// Mapeamentos
// --------------------------------------------------------------------------

const NOMES = [
  'Maria', 'Ana', 'Camila', 'Luciana', 'Carla', 'Patricia', 'Fernanda', 'Juliana',
  'Beatriz', 'Sandra', 'Daniel', 'Pedro', 'Thiago', 'Antonio', 'Rafael', 'Lucas',
  'Marcos', 'Eduardo', 'Roberto', 'Felipe',
]
const SOBRENOMES = 'ABCDEFGHIJKLMNOPRSTV'

function nomeDeterministico(patientId: string, sex: string): string {
  let h = 0
  for (let i = 0; i < patientId.length; i++) h = (h * 31 + patientId.charCodeAt(i)) >>> 0
  const femininos = NOMES.slice(0, 10)
  const masculinos = NOMES.slice(10)
  const pool = sex === 'Feminino' ? femininos : masculinos
  const primeiro = pool[h % pool.length]
  const sobrenome = SOBRENOMES[(h >>> 5) % SOBRENOMES.length]
  return `${primeiro} ${sobrenome}.`
}

function tierParaPrioridade(score: number, tier: AcsWeekRow['tier']): Prioridade {
  if (tier === 'high') return score >= 75 ? 'critica' : 'alta'
  if (tier === 'medium') return 'media'
  return 'baixa'
}

function condicoesDeFlags(p: AcsWeekRow): Condicao[] {
  const c: Condicao[] = []
  if (p.pregnant) c.push('gestante')
  if (p.diabetic) c.push('diabetico')
  if (p.hypertensive) c.push('hipertenso')
  if (p.social_vulnerability) c.push('vulneravel')
  if (p.age_band === '0-6') c.push('crianca')
  return c
}

const FAIXAS_VALIDAS: FaixaEtaria[] = ['0-6', '6-18', '19-45', '45-65', '66+']
function faixaEtaria(raw: string): FaixaEtaria {
  return (FAIXAS_VALIDAS.includes(raw as FaixaEtaria) ? raw : '19-45') as FaixaEtaria
}

const RACAS_VALIDAS: RacaCor[] = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Outros']
function racaCor(raw: string | null): RacaCor {
  if (!raw) return 'Outros'
  return (RACAS_VALIDAS.includes(raw as RacaCor) ? raw : 'Outros') as RacaCor
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mapRow(p: AcsWeekRow, teamLat: number, teamLng: number): Paciente {
  const distanciaKm = haversineKm(teamLat, teamLng, p.latitude, p.longitude)
  return {
    id: p.patient_id,
    nome: nomeDeterministico(p.patient_id, p.sex),
    equipeId: p.team_id,
    unidadeId: p.team_id.slice(0, 8),
    faixaEtaria: faixaEtaria(p.age_band),
    sexo: p.sex === 'Feminino' ? 'Feminino' : 'Masculino',
    racaCor: racaCor(p.race_color),
    situacaoVulnerabilidade: p.social_vulnerability,
    lat: p.latitude,
    lng: p.longitude,
    distanciaKm: Math.round(distanciaKm * 10) / 10,
    hipertenso: p.hypertensive,
    diabetico: p.diabetic,
    gestante: p.pregnant,
    condicoes: condicoesDeFlags(p),
    prioridade: tierParaPrioridade(p.score, p.tier),
    prioScore: p.score,
    motivoPrioridade: (p.reason ?? '').replace(/\.$/, ''),
    ultimaVisita: p.last_visit,
    enderecoDescricao: `${(Math.round(distanciaKm * 10) / 10).toString().replace('.', ',')} km da unidade`,
  }
}

// --------------------------------------------------------------------------
// Geo da equipe (clínica)
// --------------------------------------------------------------------------

export interface GeoEquipe {
  lat: number
  lng: number
}

export async function fetchTeamGeo(teamId: string): Promise<GeoEquipe> {
  const { data, error } = await supabase
    .from('teams')
    .select('latitude, longitude')
    .eq('team_id', teamId)
    .single()
  if (error || !data) throw error ?? new Error('equipe não encontrada')
  return { lat: data.latitude, lng: data.longitude }
}

export function googleMapsUrl(p: Pick<Paciente, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
}

// --------------------------------------------------------------------------
// Lista da semana do ACS — engine SSOT via acs_week_list
// --------------------------------------------------------------------------

// O acs_id vem do JWT (RPC SECURITY DEFINER, migration 013) — não é parâmetro.
export async function fetchAcsWeekList(refDate = REF_DATE): Promise<Paciente[]> {
  const { data, error } = await supabase.rpc('acs_week_list', {
    p_period_start: refDate,
  })
  if (error) throw error
  const rows = (data as AcsWeekRow[]) ?? []
  if (rows.length === 0) return []

  const geo = await fetchTeamGeo(rows[0].team_id)
  return rows.map((r) => mapRow(r, geo.lat, geo.lng))
}

// --------------------------------------------------------------------------
// Detalhe do paciente — patient_detail
// --------------------------------------------------------------------------

export async function fetchPacienteDetalhe(
  patientId: string,
  refDate = REF_DATE,
): Promise<Paciente | null> {
  const { data, error } = await supabase.rpc('patient_detail', {
    p_patient_id: patientId,
    p_period_start: refDate,
  })
  if (error) throw error
  if (!data || !data.patient) return null

  const p = data.patient as Partial<AcsWeekRow> & { team_id: string }
  const geo = await fetchTeamGeo(p.team_id)
  // patient_detail pode não ter priority_order/last_visit; preenche defaults.
  const row: AcsWeekRow = {
    patient_id: p.patient_id as string,
    team_id: p.team_id,
    age_band: (p.age_band as string) ?? '19-45',
    sex: (p.sex as string) ?? 'Feminino',
    race_color: (p.race_color as string) ?? null,
    social_vulnerability: !!p.social_vulnerability,
    latitude: p.latitude as number,
    longitude: p.longitude as number,
    hypertensive: !!p.hypertensive,
    diabetic: !!p.diabetic,
    pregnant: !!p.pregnant,
    priority_order: p.priority_order ?? 0,
    score: p.score ?? 0,
    score_icsap: p.score_icsap ?? 0,
    score_life_stage: p.score_life_stage ?? 0,
    score_care_gap: p.score_care_gap ?? 0,
    score_social: p.score_social ?? 0,
    tier: (p.tier as AcsWeekRow['tier']) ?? 'routine',
    reason: (p.reason as string) ?? '',
    status: (p.status as string) ?? 'pending',
    last_visit: null,
  }
  return mapRow(row, geo.lat, geo.lng)
}

// Distribui em 5 dias úteis (seg a sex da semana atual), até 5 por dia.
export function distribuirSemana(pacientes: Paciente[]): Map<string, Paciente[]> {
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() - ((diaSemana === 0 ? 7 : diaSemana) - 1))

  const dias = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const mapa = new Map<string, Paciente[]>()
  dias.forEach((d) => mapa.set(d, []))

  // Mantém a ordem do engine (priority_order já vem da RPC, com rota otimizada).
  let diaIdx = 0
  for (const p of pacientes) {
    while (diaIdx < dias.length) {
      const lista = mapa.get(dias[diaIdx])!
      if (lista.length < 5) {
        lista.push(p)
        break
      }
      diaIdx++
    }
  }
  return mapa
}
