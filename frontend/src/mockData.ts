import type { Paciente } from './types'

// Equipe de referência — lat/lng da unidade de saúde (dados reais, parquet equipes)
export const EQUIPE_LAT = -22.928956
export const EQUIPE_LNG = -43.233984

// Gera link Google Maps apenas para o endereço do paciente (sem sugestão de rota)
export function googleMapsUrl(paciente: Paciente): string {
  return `https://www.google.com/maps/search/?api=1&query=${paciente.lat},${paciente.lng}`
}

// Paciente de demonstração: idosa hipertensa + diabética com histórico preenchido
export const PACIENTE_HIPERTENSO: Paciente = {
  id: 'p-001',
  nome: 'Maria F.',
  equipeId: '0206636a',
  unidadeId: 'def3447c',
  faixaEtaria: '66+',
  sexo: 'Feminino',
  racaCor: 'Branca',
  situacaoVulnerabilidade: true,
  lat: -22.941234,
  lng: -43.252318,
  distanciaKm: 2.1,
  enderecoDescricao: '2,1 km da unidade',
  hipertenso: true,
  diabetico: true,
  gestante: false,
  condicoes: ['hipertenso', 'diabetico', 'vulneravel'],
  prioridade: 'critica',
  prioScore: 85,
  motivoPrioridade: 'hipertenso + diabético · idoso 66+ · vulnerável · sem visita há 365d',
  ultimaVisita: '2025-05-24',
  ultimoRegistroHipertensao: {
    tomaMedicacao: true,
    pressao: '150/95',
    sintomas: 'Cefaleia leve',
    dataRegistro: '2025-05-24',
  },
}

// Dados reais derivados dos parquets (equipe 0206636a, PRIO-ACS score calculado)
export const MOCK_PACIENTES: Paciente[] = [
  PACIENTE_HIPERTENSO,

  {
    id: 'p-002',
    nome: 'Ana S.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Preta',
    situacaoVulnerabilidade: true,
    lat: -22.956892, lng: -43.258394, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico', 'vulneravel'],
    prioridade: 'critica', prioScore: 82,
    motivoPrioridade: 'hipertenso + diabético · idoso 66+ · vulnerável · sem visita há 332d',
    ultimaVisita: '2025-06-27',
  },
  {
    id: 'p-003',
    nome: 'Francisca M.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.940956, lng: -43.259956, distanciaKm: 2.1,
    enderecoDescricao: '2,1 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'critica', prioScore: 72,
    motivoPrioridade: '2 urgência/internação · hipertenso + diabético · idoso 66+ · sem visita há 365d',
    ultimaVisita: '2025-05-24',
  },
  {
    id: 'p-004',
    nome: 'Luciana C.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Parda',
    situacaoVulnerabilidade: true,
    lat: -22.956234, lng: -43.258605, distanciaKm: 3.1,
    enderecoDescricao: '3,1 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico', 'vulneravel'],
    prioridade: 'critica', prioScore: 72,
    motivoPrioridade: 'hipertenso + diabético · idoso 66+ · vulnerável · sem visita há 183d',
    ultimaVisita: '2025-11-22',
  },

  {
    id: 'p-005',
    nome: 'Sandra A.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Branca',
    situacaoVulnerabilidade: false,
    lat: -22.956100, lng: -43.257900, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'alta', prioScore: 68,
    motivoPrioridade: '3 urgência/internação · hipertenso + diabético · idoso 66+',
    ultimaVisita: '2026-03-10',
  },
  {
    id: 'p-006',
    nome: 'Patrícia N.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '45-65', sexo: 'Feminino', racaCor: 'Parda',
    situacaoVulnerabilidade: true,
    lat: -22.955800, lng: -43.258000, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico', 'vulneravel'],
    prioridade: 'alta', prioScore: 67,
    motivoPrioridade: 'hipertenso + diabético · vulnerável · sem visita há 327d',
    ultimaVisita: '2025-07-02',
  },
  {
    id: 'p-007',
    nome: 'Marcos P.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.955700, lng: -43.257800, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'alta', prioScore: 67,
    motivoPrioridade: 'hipertenso + diabético · idoso 66+ · sem visita há 328d',
    ultimaVisita: '2025-07-01',
  },
  {
    id: 'p-008',
    nome: 'Claudia O.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.955600, lng: -43.257600, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'alta', prioScore: 67,
    motivoPrioridade: 'hipertenso + diabético · idoso 66+ · sem visita há 334d',
    ultimaVisita: '2025-06-25',
  },
  {
    id: 'p-009',
    nome: 'Fernanda R.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Feminino', racaCor: 'Branca',
    situacaoVulnerabilidade: false,
    lat: -22.955500, lng: -43.257500, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'alta', prioScore: 66,
    motivoPrioridade: '6 urgência/internação · hipertenso + diabético · idoso 66+',
    ultimaVisita: '2026-02-15',
  },

  {
    id: 'p-010',
    nome: 'Francisco B.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '45-65', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.953200, lng: -43.256800, distanciaKm: 2.9,
    enderecoDescricao: '2,9 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: 'hipertenso + diabético · sem visita há 283d',
    ultimaVisita: '2025-08-15',
  },
  {
    id: 'p-011',
    nome: 'Roberto L.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '66+', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.951800, lng: -43.255700, distanciaKm: 2.8,
    enderecoDescricao: '2,8 km da unidade',
    hipertenso: true, diabetico: false, gestante: false,
    condicoes: ['hipertenso'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: '1 urgência/internação · hipertenso · idoso 66+ · sem visita há 223d',
    ultimaVisita: '2025-10-13',
  },
  {
    id: 'p-012',
    nome: 'João V.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '0-6', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: true,
    lat: -22.950200, lng: -43.254600, distanciaKm: 2.7,
    enderecoDescricao: '2,7 km da unidade',
    hipertenso: false, diabetico: false, gestante: false,
    condicoes: ['crianca', 'vulneravel'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: 'criança 0-6a · vulnerável · sem visita há 218d',
    ultimaVisita: '2025-10-19',
  },
  {
    id: 'p-013',
    nome: 'Francisca G.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '45-65', sexo: 'Feminino', racaCor: 'Preta',
    situacaoVulnerabilidade: false,
    lat: -22.956500, lng: -43.259100, distanciaKm: 3.1,
    enderecoDescricao: '3,1 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: '1 urgência/internação · hipertenso + diabético · sem visita há 239d',
    ultimaVisita: '2025-09-28',
  },
  {
    id: 'p-014',
    nome: 'Sebastião T.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '0-6', sexo: 'Masculino', racaCor: 'Branca',
    situacaoVulnerabilidade: true,
    lat: -22.955900, lng: -43.258100, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: false, diabetico: false, gestante: false,
    condicoes: ['crianca', 'vulneravel'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: 'criança 0-6a · vulnerável · sem visita há 211d',
    ultimaVisita: '2025-10-26',
  },
  {
    id: 'p-015',
    nome: 'Antônio D.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '45-65', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.956700, lng: -43.259400, distanciaKm: 3.1,
    enderecoDescricao: '3,1 km da unidade',
    hipertenso: true, diabetico: true, gestante: false,
    condicoes: ['hipertenso', 'diabetico'],
    prioridade: 'media', prioScore: 49,
    motivoPrioridade: '2 urgência/internação · hipertenso + diabético · sem visita há 229d',
    ultimaVisita: '2025-10-08',
  },

  {
    id: 'p-016',
    nome: 'José K.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '45-65', sexo: 'Masculino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.950500, lng: -43.254900, distanciaKm: 2.7,
    enderecoDescricao: '2,7 km da unidade',
    hipertenso: true, diabetico: false, gestante: false,
    condicoes: ['hipertenso'],
    prioridade: 'baixa', prioScore: 29,
    motivoPrioridade: '2 urgência/internação · hipertenso · sem visita há 181d',
    ultimaVisita: '2025-11-24',
  },
  {
    id: 'p-017',
    nome: 'Juliana Q.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '6-18', sexo: 'Feminino', racaCor: 'Parda',
    situacaoVulnerabilidade: false,
    lat: -22.956800, lng: -43.259600, distanciaKm: 3.1,
    enderecoDescricao: '3,1 km da unidade',
    hipertenso: false, diabetico: false, gestante: false,
    condicoes: [],
    prioridade: 'baixa', prioScore: 29,
    motivoPrioridade: '4 urgência/internação · sem visita há 378d',
    ultimaVisita: '2025-05-11',
  },
  {
    id: 'p-018',
    nome: 'Claudia Z.',
    equipeId: '0206636a', unidadeId: 'def3447c',
    faixaEtaria: '19-45', sexo: 'Feminino', racaCor: 'Branca',
    situacaoVulnerabilidade: false,
    lat: -22.955400, lng: -43.257400, distanciaKm: 3.0,
    enderecoDescricao: '3,0 km da unidade',
    hipertenso: false, diabetico: false, gestante: false,
    condicoes: [],
    prioridade: 'baixa', prioScore: 29,
    motivoPrioridade: '4 urgência/internação · sem visita há 365d',
    ultimaVisita: '2025-05-24',
  },
]

export function getPacientesSemana(): Map<string, Paciente[]> {
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() - ((diaSemana === 0 ? 7 : diaSemana) - 1))

  const diasUteis = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const mapa = new Map<string, Paciente[]>()
  diasUteis.forEach((dia) => mapa.set(dia, []))

  const prioOrdem = { critica: 0, alta: 1, media: 2, baixa: 3 }
  const ordenados = [...MOCK_PACIENTES].sort((a, b) => {
    const diff = prioOrdem[a.prioridade] - prioOrdem[b.prioridade]
    return diff !== 0 ? diff : b.prioScore - a.prioScore
  })

  // Distribui igualmente: ceil(total / dias) por dia, máximo 5
  const maxPorDia = Math.min(5, Math.ceil(ordenados.length / diasUteis.length))

  let diaIdx = 0
  for (const p of ordenados) {
    while (diaIdx < diasUteis.length) {
      const lista = mapa.get(diasUteis[diaIdx])!
      if (lista.length < maxPorDia) {
        lista.push(p)
        break
      }
      diaIdx++
    }
  }

  return mapa
}
