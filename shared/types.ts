export type Condicao = 'gestante' | 'diabetico' | 'hipertenso' | 'vulneravel' | 'crianca'

export type RespostaSN = 'sim' | 'nao' | 'nao_sei'
export type Frequencia5pt = 'sempre' | 'quase_sempre' | 'as_vezes' | 'quase_nunca' | 'nunca' | 'nao_sei'
export type MudancaEstiloVida = 'nao' | 'tabagismo' | 'atividade_fisica' | 'alimentacao'
export type GanhoPesoGestante = 'adequado' | 'muito' | 'pouco' | 'nao_sei'
export type AlimentacaoCrianca = 'lm_exclusivo' | 'lm_agua_cha' | 'lm_outro_leite' | 'outro_leite' | 'lm_outros' | 'lm_outro_leite_outros' | 'outro_leite_outros' | 'outros'
export type SinalRiscoCrianca = 'cansaco' | 'febre' | 'irritabilidade' | 'tosse' | 'diarreia' | 'gemido' | 'nao_suga' | 'vomitos' | 'cansaco_respirar' | 'lesoes_pele' | 'internacao' | 'outros'
export type OndeDormeCrianca = 'berco' | 'chao' | 'cama_compartilhada' | 'sofa'

export type Prioridade = 'critica' | 'alta' | 'media' | 'baixa'

export type RacaCor = 'Branca' | 'Preta' | 'Parda' | 'Amarela' | 'Indígena' | 'Outros'
export type FaixaEtaria = '0-6' | '6-18' | '19-45' | '45-65' | '66+'

export interface RegistroHipertensao {
  tomaMedicacao: boolean
  pressao: string
  sintomas: string
  dataRegistro: string
}

export interface Paciente {
  id: string
  nome: string
  // campos do modelo de dados do README
  equipeId: string
  unidadeId: string
  faixaEtaria: FaixaEtaria
  sexo: 'Masculino' | 'Feminino'
  racaCor: RacaCor
  situacaoVulnerabilidade: boolean
  lat: number
  lng: number
  distanciaKm: number
  hipertenso: boolean
  diabetico: boolean
  gestante: boolean
  // campos derivados para UI
  condicoes: Condicao[]
  prioridade: Prioridade
  prioScore: number
  motivoPrioridade: string
  ultimaVisita: string | null
  enderecoDescricao: string
  // dados históricos opcionais
  ultimoRegistroHipertensao?: RegistroHipertensao
}

export interface RegistroVisita {
  id?: number
  pacienteId: string
  profissionalId: string
  dataVisita: string // YYYY-MM-DD
  hora: string // HH:MM
  synced: boolean
  createdAt: number

  // presença
  estavaCasa: boolean
  recusouVisita: boolean

  // dados gerais observados na visita (atualização do cadastro)
  racaCorAtualizada?: RacaCor
  situacaoVulnerabilidadeAtualizada?: boolean
  observacoesGerais: string

  // gestante
  semanaGestacional?: number
  preNatalEmDia?: boolean
  riscoGestacional?: 'baixo' | 'alto'
  edema?: boolean

  // diabético
  tomaMedicacaoDiabetes?: boolean
  tomaInsulina?: boolean
  fazDieta?: boolean
  ultimaGlicemia?: string
  peDiabetico?: boolean

  // hipertenso — sub-form dedicado
  tomaMedicacaoHipertensao?: boolean
  adesaoMedicacaoHipertensao?: 'regular' | 'irregular' | 'nao_toma'
  pressaoAferidaHoje?: boolean
  valorPressao?: string
  sintomas?: string // cefaleia, tontura, etc.

  // criança
  pesoCrianca?: string
  vacinasEmDia?: boolean
  aleitamentoMaterno?: boolean
  desenvolvimentoNormal?: boolean

  // vulnerável
  situacaoRisco?: boolean
  precisaEncaminhamento?: boolean   // auto-computed OR manual

  // Ficha B Crônico — perguntas oficiais SMS-Rio
  dum?: string                      // DUM gestante (YYYY-MM-DD)
  p1_esqueceu_dose?: RespostaSN
  p2_dificuldade_lembrar?: Frequencia5pt
  p3_desconforto_medicacao?: RespostaSN
  p4_duvida_tratamento?: RespostaSN
  p5_mudanca_estilo_vida?: MudancaEstiloVida
  p6_upa_emergencia?: 'sim' | 'nao'
  p7_pe_diabetico?: RespostaSN

  // Ficha B Gestante — perguntas oficiais
  p1g_mediu_pressao?: RespostaSN
  p2g_upa_maternidade?: 'sim' | 'nao'
  p3g_realizou_exames?: RespostaSN
  p4g_enjoando?: RespostaSN
  p5g_sangramento?: 'sim' | 'nao'
  p6g_ardencia_urinar?: RespostaSN
  p7g_ganho_peso?: GanhoPesoGestante
  p8g_inchaco_pernas?: RespostaSN
  p9g_bebe_mexeu?: 'sim' | 'nao'
  p10g_visitou_maternidade?: RespostaSN

  // Ficha C Criança — perguntas oficiais
  idadeMeses?: number
  p1c_consulta_7d?: RespostaSN
  p2c_onde_dorme?: OndeDormeCrianca
  p3c_consultas?: RespostaSN
  p4c_vacinacao?: RespostaSN
  p5c_alimentacao?: AlimentacaoCrianca
  p6c_sinais_risco?: SinalRiscoCrianca[]
  p7c_alteracao_desenvolvimento?: RespostaSN
  p8c_bpc?: RespostaSN
  p9c_inseguranca_alimentar?: RespostaSN
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error'
