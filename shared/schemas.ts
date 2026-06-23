// Schemas Zod para validação dos formulários de visita.
// Compartilhado entre PWA e Expo — valida os mesmos dados nos dois apps.
// Instale: npm install zod (já está no PWA; adicionar ao Expo também)

import { z } from 'zod'

const sn = z.enum(['sim', 'nao', 'nao_sei'])
const freq5 = z.enum(['sempre', 'quase_sempre', 'as_vezes', 'quase_nunca', 'nunca', 'nao_sei'])

export const VisitaPresencaSchema = z.object({
  estavaCasa: z.boolean(),
  recusouVisita: z.boolean(),
})

export const VisitaHipertensoSchema = z.object({
  tomaMedicacaoHipertensao: z.boolean().optional(),
  adesaoMedicacaoHipertensao: z.enum(['regular', 'irregular', 'nao_toma']).optional(),
  pressaoAferidaHoje: z.boolean().optional(),
  valorPressao: z.string().optional(),
  sintomas: z.string().optional(),
})

export const VisitaDiabetesSchema = z.object({
  tomaMedicacaoDiabetes: z.boolean().optional(),
  tomaInsulina: z.boolean().optional(),
  fazDieta: z.boolean().optional(),
  ultimaGlicemia: z.string().optional(),
  peDiabetico: z.boolean().optional(),
})

export const VisitaGestanteSchema = z.object({
  semanaGestacional: z.number().int().min(1).max(42).optional(),
  preNatalEmDia: z.boolean().optional(),
  riscoGestacional: z.enum(['baixo', 'alto']).optional(),
  edema: z.boolean().optional(),
  dum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  p1g_mediu_pressao: sn.optional(),
  p2g_upa_maternidade: z.enum(['sim', 'nao']).optional(),
  p3g_realizou_exames: sn.optional(),
  p4g_enjoando: sn.optional(),
  p5g_sangramento: z.enum(['sim', 'nao']).optional(),
  p6g_ardencia_urinar: sn.optional(),
  p7g_ganho_peso: z.enum(['adequado', 'muito', 'pouco', 'nao_sei']).optional(),
  p8g_inchaco_pernas: sn.optional(),
  p9g_bebe_mexeu: z.enum(['sim', 'nao']).optional(),
  p10g_visitou_maternidade: sn.optional(),
})

export const VisitaCriancaSchema = z.object({
  pesoCrianca: z.string().optional(),
  vacinasEmDia: z.boolean().optional(),
  aleitamentoMaterno: z.boolean().optional(),
  desenvolvimentoNormal: z.boolean().optional(),
  idadeMeses: z.number().int().min(0).optional(),
  p1c_consulta_7d: sn.optional(),
  p2c_onde_dorme: z.enum(['berco', 'chao', 'cama_compartilhada', 'sofa']).optional(),
  p3c_consultas: sn.optional(),
  p4c_vacinacao: sn.optional(),
  p6c_sinais_risco: z.array(z.string()).optional(),
  p7c_alteracao_desenvolvimento: sn.optional(),
  p8c_bpc: sn.optional(),
  p9c_inseguranca_alimentar: sn.optional(),
})

export const VisitaCronicoSchema = z.object({
  p1_esqueceu_dose: sn.optional(),
  p2_dificuldade_lembrar: freq5.optional(),
  p3_desconforto_medicacao: sn.optional(),
  p4_duvida_tratamento: sn.optional(),
  p5_mudanca_estilo_vida: z.enum(['nao', 'tabagismo', 'atividade_fisica', 'alimentacao']).optional(),
  p6_upa_emergencia: z.enum(['sim', 'nao']).optional(),
  p7_pe_diabetico: sn.optional(),
})

export const RegistroVisitaSchema = z.object({
  pacienteId: z.string().min(1),
  profissionalId: z.string().min(1),
  dataVisita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  estavaCasa: z.boolean(),
  recusouVisita: z.boolean(),
  observacoesGerais: z.string().default(''),
  precisaEncaminhamento: z.boolean().optional(),
})
  .merge(VisitaHipertensoSchema)
  .merge(VisitaDiabetesSchema)
  .merge(VisitaGestanteSchema)
  .merge(VisitaCriancaSchema)
  .merge(VisitaCronicoSchema)

export type RegistroVisitaInput = z.infer<typeof RegistroVisitaSchema>
