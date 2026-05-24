// Adapter entre o schema do Supabase (snake_case, raw) e o tipo Paciente
// que o resto do app já consome. Mantém a interface estável; só a fonte
// de dados muda — de realData.ts (estático) para Supabase ao vivo.

import type { Condicao, FaixaEtaria, Paciente, Prioridade, RacaCor } from '../types'
import { DEMO_EQUIPE_ID, REF_DATE, supabase } from './supabase'

// --------------------------------------------------------------------------
// Shape que vem das RPCs do Supabase
// --------------------------------------------------------------------------

interface RpcPaciente {
  paciente_id: string
  equipe_id: string
  nome_display: string
  faixa_etaria: string
  sexo: string
  raca_cor: string | null
  hipertenso: boolean
  diabetico: boolean
  gestacao: boolean
  situacao_vulnerabilidade: boolean
  endereco_latitude: number
  endereco_longitude: number
  score: number
  score_icsap: number
  score_life_stage: number
  score_care_gap: number
  score_social: number
  tier: 'alto' | 'medio' | 'habitual'
  cadencia_oficial: string
  linha_de_cuidado: string
  ultima_visita: string | null
  dias_gap: number
  gap_limite: number
  gap_vencido: boolean
  evento_recente_60d: boolean
  ultimo_evento_tipo: string | null
  ultimo_evento_data: string | null
  motivo_curto: string
}

// --------------------------------------------------------------------------
// Mapeamentos
// --------------------------------------------------------------------------

// Nome de exibição determinístico a partir do hash do paciente.
// O dataset é anonimizado; usamos uma persona estável pra demo soar humana.
const NOMES = [
  'Maria', 'Ana', 'Camila', 'Luciana', 'Carla', 'Patricia', 'Fernanda', 'Juliana',
  'Beatriz', 'Sandra', 'Daniel', 'Pedro', 'Thiago', 'Antonio', 'Rafael', 'Lucas',
  'Marcos', 'Eduardo', 'Roberto', 'Felipe',
]
const SOBRENOMES = 'ABCDEFGHIJKLMNOPRSTV'

function nomeDeterministico(pacienteId: string, sexo: string): string {
  // hash simples: soma de char codes
  let h = 0
  for (let i = 0; i < pacienteId.length; i++) h = (h * 31 + pacienteId.charCodeAt(i)) >>> 0
  const femininos = NOMES.slice(0, 10)
  const masculinos = NOMES.slice(10)
  const pool = sexo === 'Feminino' ? femininos : masculinos
  const primeiro = pool[h % pool.length]
  const sobrenome = SOBRENOMES[(h >>> 5) % SOBRENOMES.length]
  return `${primeiro} ${sobrenome}.`
}

function tierParaPrioridade(score: number, tier: RpcPaciente['tier']): Prioridade {
  if (tier === 'alto') return score >= 75 ? 'critica' : 'alta'
  if (tier === 'medio') return 'media'
  return 'baixa'
}

function condicoesDeFlags(p: RpcPaciente): Condicao[] {
  const c: Condicao[] = []
  if (p.gestacao) c.push('gestante')
  if (p.diabetico) c.push('diabetico')
  if (p.hipertenso) c.push('hipertenso')
  if (p.situacao_vulnerabilidade) c.push('vulneravel')
  if (p.faixa_etaria === '0-6') c.push('crianca')
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

function mapRow(p: RpcPaciente, equipeLat: number, equipeLng: number): Paciente {
  const distanciaKm = haversineKm(equipeLat, equipeLng, p.endereco_latitude, p.endereco_longitude)
  return {
    id: p.paciente_id,
    nome: nomeDeterministico(p.paciente_id, p.sexo),
    equipeId: p.equipe_id,
    unidadeId: p.equipe_id.slice(0, 8), // placeholder; RPC não traz unidade_id
    faixaEtaria: faixaEtaria(p.faixa_etaria),
    sexo: p.sexo === 'Feminino' ? 'Feminino' : 'Masculino',
    racaCor: racaCor(p.raca_cor),
    situacaoVulnerabilidade: p.situacao_vulnerabilidade,
    lat: p.endereco_latitude,
    lng: p.endereco_longitude,
    distanciaKm: Math.round(distanciaKm * 10) / 10,
    hipertenso: p.hipertenso,
    diabetico: p.diabetico,
    gestante: p.gestacao,
    condicoes: condicoesDeFlags(p),
    prioridade: tierParaPrioridade(p.score, p.tier),
    prioScore: p.score,
    motivoPrioridade: p.motivo_curto.replace(/\.$/, ''),
    ultimaVisita: p.ultima_visita,
    enderecoDescricao: `${(Math.round(distanciaKm * 10) / 10).toString().replace('.', ',')} km da unidade`,
  }
}

// --------------------------------------------------------------------------
// Fetch público — o que ListaPage / SupervisorPage chama
// --------------------------------------------------------------------------

export interface GeoEquipe {
  lat: number
  lng: number
}

export async function fetchEquipeGeo(equipeId = DEMO_EQUIPE_ID): Promise<GeoEquipe> {
  const { data, error } = await supabase
    .from('equipes')
    .select('endereco_latitude, endereco_longitude')
    .eq('equipe_id', equipeId)
    .single()
  if (error || !data) throw error ?? new Error('equipe não encontrada')
  return { lat: data.endereco_latitude, lng: data.endereco_longitude }
}

export function googleMapsUrl(p: Pick<Paciente, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
}

export async function fetchPacienteDetalhe(
  pacienteId: string,
  refDate = REF_DATE,
): Promise<Paciente | null> {
  const { data, error } = await supabase.rpc('paciente_detalhe', {
    p_paciente_id: pacienteId,
    p_ref_date: refDate,
  })
  if (error) throw error
  if (!data || !data.paciente) return null

  const equipeId = data.paciente.equipe_id as string
  const geo = await fetchEquipeGeo(equipeId)
  return mapRow(data.paciente as RpcPaciente, geo.lat, geo.lng)
}

export async function fetchPacientesPriorizados(
  equipeId = DEMO_EQUIPE_ID,
  refDate = REF_DATE,
  limit = 25,
): Promise<Paciente[]> {
  const { data, error } = await supabase
    .rpc('priorizacao_pacientes', { p_equipe_id: equipeId, p_ref_date: refDate })
    .order('score', { ascending: false })
    .limit(limit)
  if (error) throw error

  const geo = await fetchEquipeGeo(equipeId)
  return (data as RpcPaciente[]).map((r) => mapRow(r, geo.lat, geo.lng))
}

// Distribui em 5 dias úteis (seg a sex da semana atual), até 5 por dia.
// Mantém compatibilidade com getPacientesSemana() do realData.
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

  const ordem: Record<Prioridade, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }
  const ordenados = [...pacientes].sort((a, b) => {
    const diff = ordem[a.prioridade] - ordem[b.prioridade]
    return diff !== 0 ? diff : b.prioScore - a.prioScore
  })

  let diaIdx = 0
  for (const p of ordenados) {
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
