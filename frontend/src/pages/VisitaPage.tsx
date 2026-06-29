import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CondicaoBadge } from '../components/CondicaoBadge'
import { PrioridadeBadge } from '../components/PrioridadeBadge'
import { salvarVisita } from '../db'
import { googleMapsUrl } from '../lib/supabaseAdapter'
import { usePacienteDetalhe } from '../hooks/usePacienteDetalhe'
import { useAuth } from '../hooks/useAuth'
import type {
  RegistroVisita, RacaCor,
  RespostaSN, Frequencia5pt, MudancaEstiloVida,
  GanhoPesoGestante, AlimentacaoCrianca, SinalRiscoCrianca, OndeDormeCrianca,
} from '../types'

const RACAS: RacaCor[] = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Outros']

function getCamposFaltando(
  form: Partial<RegistroVisita>,
  paciente: import('../types').Paciente,
  semanaGest: number | undefined,
  foiAtendido: boolean,
): string[] {
  if (!foiAtendido) return []
  const f: string[] = []

  if (paciente.hipertenso || paciente.diabetico) {
    if (!form.p1_esqueceu_dose) f.push('Ficha B · P1 – Esqueceu alguma dose?')
    if (!form.p2_dificuldade_lembrar) f.push('Ficha B · P2 – Frequência de dificuldade')
    if (!form.p3_desconforto_medicacao) f.push('Ficha B · P3 – Desconforto com medicação?')
    if (!form.p4_duvida_tratamento) f.push('Ficha B · P4 – Dificuldade com tratamento?')
    if (!form.p5_mudanca_estilo_vida) f.push('Ficha B · P5 – Mudança de estilo de vida')
    if (!form.p6_upa_emergencia) f.push('Ficha B · P6 – Foi à UPA/Emergência?')
    if (paciente.diabetico && !form.p7_pe_diabetico) f.push('Ficha B · P7 – Machucado no pé?')
    if (paciente.hipertenso && form.pressaoAferidaHoje === undefined) f.push('Ficha B · Aferiu a pressão hoje?')
    if (form.pressaoAferidaHoje === true && !(form.valorPressao as string)) f.push('Ficha B · Valor da pressão')
  }

  if (paciente.gestante) {
    if (!form.p1g_mediu_pressao) f.push('Gestante · P1 – Mediu a pressão?')
    if (!form.p2g_upa_maternidade) f.push('Gestante · P2 – Foi à UPA/maternidade?')
    if (!form.p3g_realizou_exames) f.push('Gestante · P3 – Realizou exames?')
    if ((semanaGest === undefined || semanaGest <= 12) && !form.p5g_sangramento) f.push('Gestante · P5 – Teve sangramento?')
    if ((semanaGest === undefined || (semanaGest >= 25)) && !form.p9g_bebe_mexeu) f.push('Gestante · P9 – Bebê mexeu?')
  }

  if (paciente.faixaEtaria === '0-6') {
    if (!form.p3c_consultas) f.push('Criança · P3 – Consultas em dia?')
    if (!form.p4c_vacinacao) f.push('Criança · P4 – Vacinação em dia?')
    if (!form.p5c_alimentacao) f.push('Criança · P5 – Alimentação')
  }

  return f
}

export function VisitaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { paciente, loading, error } = usePacienteDetalhe(id)
  const { acsId } = useAuth()

  const [estavaCasa, setEstavaCasa] = useState<boolean | null>(null)
  const [recusouVisita, setRecusouVisita] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<Partial<RegistroVisita>>({})
  const [mostrarEncaminhamento, setMostrarEncaminhamento] = useState(false)

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Carregando paciente…</div>
  }

  if (error || !paciente) {
    return (
      <div className="p-8 text-center text-slate-500">
        {error ? `Erro: ${error.message}` : 'Paciente não encontrado.'}
        <button onClick={() => navigate('/')} className="block mx-auto mt-4 text-blue-600 underline">Voltar</button>
      </div>
    )
  }

  const set = (field: keyof RegistroVisita, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const toggleSinal = (sinal: SinalRiscoCrianca) => {
    const atual = (form.p6c_sinais_risco ?? []) as SinalRiscoCrianca[]
    set('p6c_sinais_risco', atual.includes(sinal) ? atual.filter((s) => s !== sinal) : [...atual, sinal])
  }

  const handleSalvar = async () => {
    if (estavaCasa === null) return
    setSalvando(true)

    const temNaoSei = Object.values(form).some((v) => v === 'nao_sei')
    const urgente = form.p6_upa_emergencia === 'sim' || form.p2g_upa_maternidade === 'sim' ||
      form.p9g_bebe_mexeu === 'nao' || form.p5g_sangramento === 'sim'
    const encaminhar = temNaoSei || urgente || form.precisaEncaminhamento === true

    const agora = new Date()
    const semanaGestacional = form.dum
      ? Math.floor((Date.now() - new Date((form.dum as string) + 'T12:00:00').getTime()) / (7 * 24 * 3600 * 1000))
      : (form.semanaGestacional as number | undefined)

    if (!acsId) {
      setSalvando(false)
      return navigate('/login')
    }

    const registro: Omit<RegistroVisita, 'id'> = {
      pacienteId: paciente.id,
      profissionalId: acsId,
      dataVisita: agora.toISOString().split('T')[0],
      hora: agora.toTimeString().slice(0, 5),
      synced: false,
      createdAt: Date.now(),
      estavaCasa,
      recusouVisita,
      observacoesGerais: (form.observacoesGerais as string) || '',
      precisaEncaminhamento: encaminhar,
      semanaGestacional,
      ...form,
    }
    await salvarVisita(registro)
    setSalvando(false)
    if (encaminhar) {
      setMostrarEncaminhamento(true)
    } else {
      navigate('/', { replace: true })
    }
  }

  const foiAtendido = estavaCasa && !recusouVisita
  const semanaGest = form.dum
    ? Math.floor((Date.now() - new Date((form.dum as string) + 'T12:00:00').getTime()) / (7 * 24 * 3600 * 1000))
    : undefined
  const camposFaltando = getCamposFaltando(form, paciente, semanaGest, foiAtendido ?? false)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-10 pb-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm mb-3 flex items-center gap-1">← Voltar</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{paciente.nome}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{paciente.sexo} · {paciente.faixaEtaria} anos · {paciente.racaCor}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {paciente.condicoes.map((c) => <CondicaoBadge key={c} condicao={c} />)}
            <PrioridadeBadge prioridade={paciente.prioridade} />
          </div>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 leading-snug">
          {paciente.motivoPrioridade}
        </p>
        <a href={googleMapsUrl(paciente)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2">
          📍 {paciente.distanciaKm.toFixed(1).replace('.', ',')} km da unidade — abrir no Maps
        </a>
      </div>

      {/* Formulário */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-36">

        <Section titulo="Presença na visita">
          <div className="grid grid-cols-2 gap-3">
            <OpcaoBtn label="✅ Estava em casa" ativo={estavaCasa === true}
              onClick={() => { setEstavaCasa(true); setRecusouVisita(false) }} />
            <OpcaoBtn label="🚪 Não estava" ativo={estavaCasa === false} onClick={() => setEstavaCasa(false)} />
          </div>
          {estavaCasa === true && (
            <div className="mt-2">
              <OpcaoBtn label="🚫 Recusou a visita" ativo={recusouVisita}
                onClick={() => setRecusouVisita((v) => !v)} fullWidth />
            </div>
          )}
        </Section>

        {foiAtendido && (
          <Section titulo="Dados gerais do paciente">
            <div className="space-y-3">
              <Campo label="Raça/cor (confirmar ou atualizar)">
                <div className="grid grid-cols-3 gap-2">
                  {RACAS.map((r) => (
                    <OpcaoBtn key={r} label={r} small
                      ativo={form.racaCorAtualizada === r || (form.racaCorAtualizada === undefined && paciente.racaCor === r)}
                      onClick={() => set('racaCorAtualizada', r)} />
                  ))}
                </div>
              </Campo>
              <Campo label="Situação de vulnerabilidade?">
                <div className="grid grid-cols-2 gap-2">
                  <OpcaoBtn label="✅ Sim"
                    ativo={form.situacaoVulnerabilidadeAtualizada === true || (form.situacaoVulnerabilidadeAtualizada === undefined && paciente.situacaoVulnerabilidade)}
                    onClick={() => set('situacaoVulnerabilidadeAtualizada', true)} />
                  <OpcaoBtn label="❌ Não"
                    ativo={form.situacaoVulnerabilidadeAtualizada === false || (form.situacaoVulnerabilidadeAtualizada === undefined && !paciente.situacaoVulnerabilidade)}
                    onClick={() => set('situacaoVulnerabilidadeAtualizada', false)} />
                </div>
              </Campo>
            </div>
          </Section>
        )}

        {foiAtendido && (paciente.hipertenso || paciente.diabetico) && (
          <SecaoCronico form={form} set={set} isDM={paciente.diabetico} historico={paciente.ultimoRegistroHipertensao} />
        )}

        {foiAtendido && paciente.gestante && (
          <SecaoGestante form={form} set={set} semanaGest={semanaGest} />
        )}

        {foiAtendido && paciente.faixaEtaria === '0-6' && (
          <SecaoCrianca form={form} set={set} toggleSinal={toggleSinal} />
        )}

        {foiAtendido && paciente.situacaoVulnerabilidade && (
          <SecaoVulneravel form={form} set={set} />
        )}

        {estavaCasa !== null && (
          <Section titulo="Observações gerais">
            <textarea className={inputCls + ' resize-none'} rows={3}
              placeholder="Anotações adicionais sobre a visita..."
              value={(form.observacoesGerais as string) || ''}
              onChange={(e) => set('observacoesGerais', e.target.value)} />
          </Section>
        )}
      </div>

      {/* Botão salvar */}
      {estavaCasa !== null && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 max-w-md mx-auto space-y-3">
          {camposFaltando.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700 mb-1">Preencha antes de salvar:</p>
              <ul className="space-y-0.5">
                {camposFaltando.slice(0, 4).map((campo) => (
                  <li key={campo} className="text-xs text-amber-600">• {campo}</li>
                ))}
                {camposFaltando.length > 4 && (
                  <li className="text-xs text-amber-500">• +{camposFaltando.length - 4} outros campos</li>
                )}
              </ul>
            </div>
          )}
          <button
            onClick={handleSalvar}
            disabled={salvando || camposFaltando.length > 0}
            className="w-full bg-blue-600 active:bg-blue-700 text-white font-semibold py-4 rounded-2xl text-base disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {salvando ? 'Salvando...' : foiAtendido ? 'Salvar visita' : 'Registrar ocorrência'}
          </button>
        </div>
      )}

      {/* Modal encaminhamento */}
      {mostrarEncaminhamento && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-4 max-w-md mx-auto">
            <div className="text-center">
              <div className="text-3xl mb-2">📋</div>
              <h2 className="text-lg font-bold text-slate-800">Indicar consulta necessária</h2>
              <p className="text-sm text-slate-500 mt-1">
                Há campos sem resposta ou alertas registrados nesta visita. Deseja marcar que este paciente precisa de consulta?
              </p>
            </div>
            <button onClick={() => navigate('/', { replace: true })}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl">
              ✅ Sim, indicar consulta
            </button>
            <button onClick={() => navigate('/', { replace: true })}
              className="w-full text-slate-500 text-sm py-2">
              Pular por agora
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SecaoCronico — Ficha B (HAS + DM) ────────────────────────────────────────

function SecaoCronico({ form, set, isDM, historico }: FormSectionProps & {
  isDM: boolean
  historico?: import('../types').RegistroHipertensao
}) {
  const titulo = isDM && (form as { hipertenso?: boolean }).hipertenso
    ? '❤️ Hipertensão + Diabetes' : isDM ? '💉 Diabetes' : '❤️ Hipertensão'

  return (
    <div className="rounded-2xl shadow-sm border-2 border-blue-300 overflow-hidden">
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-200">
        <h3 className="font-semibold text-blue-800">{titulo}</h3>
        <p className="text-xs text-blue-500 mt-0.5">Ficha B Crônico — SMS-Rio 2022</p>
      </div>

      {historico && (
        <div className="bg-blue-50 px-4 pb-3 border-b border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            Último registro · {new Date(historico.dataRegistro + 'T12:00:00').toLocaleDateString('pt-BR')}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-xl py-2 px-1 border border-blue-100">
              <div className="text-base font-bold text-slate-800">{historico.pressao}</div>
              <div className="text-xs text-slate-400">mmHg</div>
            </div>
            <div className="bg-white rounded-xl py-2 px-1 border border-blue-100">
              <div className="text-base font-bold">{historico.tomaMedicacao ? '✅' : '❌'}</div>
              <div className="text-xs text-slate-400">Medicação</div>
            </div>
            <div className="bg-white rounded-xl py-2 px-1 border border-blue-100">
              <div className="text-xs font-semibold text-slate-700 leading-tight mt-1">{historico.sintomas || 'Nenhum'}</div>
              <div className="text-xs text-slate-400">Sintomas</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white px-4 py-4 space-y-4">
        <OpcaoSN campo="p1_esqueceu_dose" label="1) Nas últimas 2 semanas, esqueceu alguma dose?" form={form} set={set} />

        <Campo label="2) Com que frequência é difícil lembrar de tomar o remédio?">
          <select className={inputCls} value={(form.p2_dificuldade_lembrar as string) || ''}
            onChange={(e) => set('p2_dificuldade_lembrar', e.target.value as Frequencia5pt)}>
            <option value="">Selecionar...</option>
            {([['sempre','Sempre'],['quase_sempre','Quase sempre'],['as_vezes','Às vezes'],['quase_nunca','Quase nunca'],['nunca','Nunca'],['nao_sei','Não sei']] as [Frequencia5pt, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Campo>

        <OpcaoSN campo="p3_desconforto_medicacao" label="3) Sente desconforto causado pela medicação?" form={form} set={set} />
        <OpcaoSN campo="p4_duvida_tratamento" label="4) Tem dificuldade ou dúvida sobre o tratamento?" form={form} set={set} />

        <Campo label="5) Está passando por alguma mudança de estilo de vida?">
          <div className="grid grid-cols-2 gap-2">
            {([['nao','Não'],['tabagismo','Cessando tabagismo'],['atividade_fisica','Atividade física'],['alimentacao','Mudando alimentação']] as [MudancaEstiloVida, string][]).map(([v, l]) => (
              <OpcaoBtn key={v} label={l} small ativo={form.p5_mudanca_estilo_vida === v} onClick={() => set('p5_mudanca_estilo_vida', v)} />
            ))}
          </div>
        </Campo>

        <Campo label="6) Precisou ir à UPA ou Emergência?">
          <div className="grid grid-cols-2 gap-2">
            <OpcaoBtn label="✅ Sim" ativo={form.p6_upa_emergencia === 'sim'} onClick={() => set('p6_upa_emergencia', 'sim')} />
            <OpcaoBtn label="❌ Não" ativo={form.p6_upa_emergencia === 'nao'} onClick={() => set('p6_upa_emergencia', 'nao')} />
          </div>
          {form.p6_upa_emergencia === 'sim' && (
            <AlertaBanner texto="⚠️ UPA/Emergência — registrar na ficha e comunicar à equipe de saúde" cor="vermelho" />
          )}
        </Campo>

        {isDM && <OpcaoSN campo="p7_pe_diabetico" label="7) Está com algum machucado no pé?" form={form} set={set} />}
        {form.p7_pe_diabetico === 'sim' && (
          <AlertaBanner texto="🦶 Pé diabético — encaminhamento prioritário + fotografar se possível" cor="laranja" />
        )}

        <Campo label="Aferiu pressão hoje?">
          <div className="grid grid-cols-2 gap-2">
            <OpcaoBtn label="✅ Sim" ativo={form.pressaoAferidaHoje === true} onClick={() => set('pressaoAferidaHoje', true)} />
            <OpcaoBtn label="❌ Não" ativo={form.pressaoAferidaHoje === false} onClick={() => set('pressaoAferidaHoje', false)} />
          </div>
        </Campo>
        {form.pressaoAferidaHoje && (
          <Campo label="Valor aferido (mmHg)">
            <input type="text" placeholder="Ex: 130/85" className={inputCls}
              value={(form.valorPressao as string) || ''} onChange={(e) => set('valorPressao', e.target.value)} />
          </Campo>
        )}
      </div>
    </div>
  )
}

// ─── SecaoGestante — Ficha B Gestante ─────────────────────────────────────────

function SecaoGestante({ form, set, semanaGest }: FormSectionProps & { semanaGest?: number }) {
  const sem = semanaGest ?? (form.semanaGestacional as number | undefined)
  return (
    <Section titulo="🤰 Gestação — Ficha B Gestante">
      <div className="space-y-4">
        <Campo label="DUM (Data da Última Menstruação)">
          <input type="date" className={inputCls} value={(form.dum as string) || ''}
            onChange={(e) => set('dum', e.target.value)} />
          {sem !== undefined && (
            <p className="text-xs text-blue-600 mt-1 font-medium">Semana gestacional calculada: {sem}ª semana</p>
          )}
        </Campo>

        <OpcaoSN campo="p1g_mediu_pressao" label="1) Você mediu a pressão?" form={form} set={set} />

        <Campo label="2) Precisou ir à UPA ou maternidade este mês?">
          <div className="grid grid-cols-2 gap-2">
            <OpcaoBtn label="✅ Sim" ativo={form.p2g_upa_maternidade === 'sim'} onClick={() => set('p2g_upa_maternidade', 'sim')} />
            <OpcaoBtn label="❌ Não" ativo={form.p2g_upa_maternidade === 'nao'} onClick={() => set('p2g_upa_maternidade', 'nao')} />
          </div>
          {form.p2g_upa_maternidade === 'sim' && (
            <AlertaBanner texto="⚠️ Indicação de gravidez de risco — comunicar enfermeira/médico da equipe" cor="vermelho" />
          )}
        </Campo>

        <OpcaoSN campo="p3g_realizou_exames" label="3) Realizou os exames solicitados?" form={form} set={set} />

        {(sem === undefined || sem <= 12) && (
          <>
            <OpcaoSN campo="p4g_enjoando" label="4) Está enjoando?" form={form} set={set} />
            <Campo label="5) Teve algum sangramento?">
              <div className="grid grid-cols-2 gap-2">
                <OpcaoBtn label="✅ Sim" ativo={form.p5g_sangramento === 'sim'} onClick={() => set('p5g_sangramento', 'sim')} />
                <OpcaoBtn label="❌ Não" ativo={form.p5g_sangramento === 'nao'} onClick={() => set('p5g_sangramento', 'nao')} />
              </div>
              {form.p5g_sangramento === 'sim' && (
                <AlertaBanner texto="🚨 Sangramento — URGÊNCIA: encaminhar imediatamente para a maternidade" cor="vermelho" />
              )}
            </Campo>
          </>
        )}

        {(sem === undefined || sem <= 24) && (
          <OpcaoSN campo="p6g_ardencia_urinar" label="6) Teve ardência ao urinar desde a última visita?" form={form} set={set} />
        )}

        {(sem === undefined || (sem >= 13 && sem <= 41)) && (
          <>
            <Campo label="7) Como avalia seu ganho de peso?">
              <div className="grid grid-cols-2 gap-2">
                {([['adequado','✅ Adequado'],['muito','⬆️ Muito peso'],['pouco','⬇️ Pouco peso'],['nao_sei','❓ Não sei']] as [GanhoPesoGestante,string][]).map(([v,l]) => (
                  <OpcaoBtn key={v} label={l} small ativo={form.p7g_ganho_peso === v} onClick={() => set('p7g_ganho_peso', v)} />
                ))}
              </div>
            </Campo>
            <OpcaoSN campo="p8g_inchaco_pernas" label="8) Tem inchaço nas pernas?" form={form} set={set} />
          </>
        )}

        {(sem === undefined || (sem >= 25 && sem <= 41)) && (
          <>
            <Campo label="9) Sentiu o bebê mexer nas últimas 24 horas?">
              <div className="grid grid-cols-2 gap-2">
                <OpcaoBtn label="✅ Sim" ativo={form.p9g_bebe_mexeu === 'sim'} onClick={() => set('p9g_bebe_mexeu', 'sim')} />
                <OpcaoBtn label="❌ Não" ativo={form.p9g_bebe_mexeu === 'nao'} onClick={() => set('p9g_bebe_mexeu', 'nao')} />
              </div>
              {form.p9g_bebe_mexeu === 'nao' && (
                <AlertaBanner texto="🚨 Não sentiu o bebê mexer — URGÊNCIA: encaminhar imediatamente à maternidade" cor="vermelho" />
              )}
            </Campo>
            <OpcaoSN campo="p10g_visitou_maternidade" label="10) Visitou a maternidade de referência?" form={form} set={set} />
          </>
        )}
      </div>
    </Section>
  )
}

// ─── SecaoCrianca — Ficha C ────────────────────────────────────────────────────

function SecaoCrianca({ form, set, toggleSinal }: FormSectionProps & {
  toggleSinal: (s: SinalRiscoCrianca) => void
}) {
  const meses = form.idadeMeses as number | undefined
  const sinais = (form.p6c_sinais_risco ?? []) as SinalRiscoCrianca[]
  const sinaisCriticos: SinalRiscoCrianca[] = ['cansaco_respirar', 'gemido', 'nao_suga', 'internacao']
  const temSinalCritico = sinais.some((s) => sinaisCriticos.includes(s))

  return (
    <Section titulo="👶 Criança 0–6 anos — Ficha C">
      <div className="space-y-4">
        <Campo label="Idade em meses">
          <input type="number" min={0} max={72} placeholder="Ex: 18" className={inputCls}
            value={meses ?? ''} onChange={(e) => set('idadeMeses', Number(e.target.value))} />
        </Campo>

        {(meses === undefined || meses <= 1) && (
          <OpcaoSN campo="p1c_consulta_7d" label="1) Realizou a primeira consulta em até 7 dias?" form={form} set={set} />
        )}
        {form.p1c_consulta_7d === 'nao' && (
          <AlertaBanner texto="⚠️ Primeira consulta em atraso — encaminhar com urgência para a unidade" cor="vermelho" />
        )}

        {(meses === undefined || meses <= 5) && (
          <Campo label="2) Onde dorme a criança?">
            <div className="grid grid-cols-2 gap-2">
              {([['berco','🛏️ Berço'],['chao','Chão'],['cama_compartilhada','Cama com outros'],['sofa','Sofá/Rede']] as [OndeDormeCrianca,string][]).map(([v,l]) => (
                <OpcaoBtn key={v} label={l} small ativo={form.p2c_onde_dorme === v} onClick={() => set('p2c_onde_dorme', v)} />
              ))}
            </div>
            {(form.p2c_onde_dorme === 'chao' || form.p2c_onde_dorme === 'cama_compartilhada') && (
              <AlertaBanner texto="⚠️ Orientar segurança do sono — risco de morte súbita infantil (SMSL)" cor="laranja" />
            )}
          </Campo>
        )}

        <OpcaoSN campo="p3c_consultas" label="3) Está comparecendo às consultas?" form={form} set={set} />
        <OpcaoSN campo="p4c_vacinacao" label="4) Vacinação em dia?" form={form} set={set} />
        {form.p4c_vacinacao === 'nao' && (
          <AlertaBanner texto="⚠️ Vacinação atrasada — encaminhar para campanha ou sala de vacinas" cor="laranja" />
        )}

        <Campo label="5) Como está a alimentação?">
          <select className={inputCls} value={(form.p5c_alimentacao as string) || ''}
            onChange={(e) => set('p5c_alimentacao', e.target.value as AlimentacaoCrianca)}>
            <option value="">Selecionar...</option>
            {([['lm_exclusivo','LM Exclusivo'],['lm_agua_cha','LM + água/chá'],['lm_outro_leite','LM + outro leite'],['outro_leite','Outro leite'],['lm_outros','LM + outros alimentos'],['outro_leite_outros','Outro leite + outros alimentos'],['outros','Outros alimentos']] as [AlimentacaoCrianca,string][]).map(([v,l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Campo>

        <Campo label="6) Sinais de risco (marque todos os presentes)">
          <div className="grid grid-cols-2 gap-2">
            {([
              ['cansaco','Cansaço'],['febre','Febre'],['tosse','Tosse'],['diarreia','Diarreia'],
              ['vomitos','Vômitos'],['lesoes_pele','Lesões de pele'],
              ['cansaco_respirar','🚨 Cansaço ao respirar'],['gemido','🚨 Gemido'],
              ['nao_suga','🚨 Não suga/engole'],['internacao','🚨 Internação recente'],
            ] as [SinalRiscoCrianca,string][]).map(([v,l]) => (
              <OpcaoBtn key={v} label={l} small ativo={sinais.includes(v)} onClick={() => toggleSinal(v)} />
            ))}
          </div>
          {temSinalCritico && (
            <AlertaBanner texto="🚨 Sinal crítico — encaminhar para atendimento IMEDIATO" cor="vermelho" />
          )}
        </Campo>

        <OpcaoSN campo="p7c_alteracao_desenvolvimento" label="7) Mãe percebeu alteração no desenvolvimento?" form={form} set={set} />
        {form.p7c_alteracao_desenvolvimento === 'sim' && (
          <AlertaBanner texto="⚠️ Encaminhar para puericultura especializada" cor="laranja" />
        )}
        <OpcaoSN campo="p8c_bpc" label="8) Perfil de BPC, mas ainda não recebe?" form={form} set={set} />
        {form.p8c_bpc === 'sim' && (
          <AlertaBanner texto="📋 Encaminhar para assistente social — direito ao BPC" cor="azul" />
        )}
        <OpcaoSN campo="p9c_inseguranca_alimentar" label="9) No último mês, a comida acabou antes do dinheiro?" form={form} set={set} />
        {form.p9c_inseguranca_alimentar === 'sim' && (
          <AlertaBanner texto="📋 Encaminhar para CRAS e verificar Bolsa Família" cor="azul" />
        )}
      </div>
    </Section>
  )
}

// ─── SecaoVulneravel ───────────────────────────────────────────────────────────

function SecaoVulneravel({ form, set }: FormSectionProps) {
  return (
    <Section titulo="🛡️ Vulnerabilidade">
      <div className="space-y-3">
        <Campo label="Situação de risco identificada?">
          <div className="grid grid-cols-2 gap-2">
            <OpcaoBtn label="✅ Sim" ativo={form.situacaoRisco === true} onClick={() => set('situacaoRisco', true)} />
            <OpcaoBtn label="❌ Não" ativo={form.situacaoRisco === false} onClick={() => set('situacaoRisco', false)} />
          </div>
        </Campo>
        <Campo label="Indicar consulta/encaminhamento?">
          <div className="grid grid-cols-2 gap-2">
            <OpcaoBtn label="✅ Sim" ativo={form.precisaEncaminhamento === true} onClick={() => set('precisaEncaminhamento', true)} />
            <OpcaoBtn label="❌ Não" ativo={form.precisaEncaminhamento === false} onClick={() => set('precisaEncaminhamento', false)} />
          </div>
        </Campo>
      </div>
    </Section>
  )
}

// ─── Primitivos ────────────────────────────────────────────────────────────────

type FormSectionProps = {
  form: Partial<RegistroVisita>
  set: (k: keyof RegistroVisita, v: unknown) => void
}

function OpcaoSN({ campo, label, form, set }: {
  campo: keyof RegistroVisita
  label: string
  form: Partial<RegistroVisita>
  set: (k: keyof RegistroVisita, v: unknown) => void
}) {
  const v = form[campo] as RespostaSN | undefined
  return (
    <Campo label={label}>
      <div className="grid grid-cols-3 gap-2">
        <OpcaoBtn label="✅ Sim" ativo={v === 'sim'} onClick={() => set(campo, 'sim')} />
        <OpcaoBtn label="❌ Não" ativo={v === 'nao'} onClick={() => set(campo, 'nao')} />
        <OpcaoBtn label="❓ Não sei" ativo={v === 'nao_sei'} onClick={() => set(campo, 'nao_sei')} small />
      </div>
    </Campo>
  )
}

function AlertaBanner({ texto, cor }: { texto: string; cor: 'vermelho' | 'laranja' | 'azul' }) {
  const cls = cor === 'vermelho'
    ? 'bg-red-50 border-red-200 text-red-700'
    : cor === 'laranja'
      ? 'bg-orange-50 border-orange-200 text-orange-700'
      : 'bg-blue-50 border-blue-200 text-blue-700'
  return (
    <div className={`mt-2 px-3 py-2 rounded-lg border text-xs font-medium leading-snug ${cls}`}>
      {texto}
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-700 mb-3">{titulo}</h3>
      {children}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function OpcaoBtn({ label, ativo, onClick, fullWidth, small }: {
  label: string; ativo: boolean; onClick: () => void; fullWidth?: boolean; small?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`py-3 px-2 rounded-xl border transition-colors text-center leading-tight ${fullWidth ? 'w-full' : ''} ${small ? 'text-xs' : 'text-sm font-medium'} ${
        ativo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 active:bg-slate-50'
      }`}>
      {label}
    </button>
  )
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
