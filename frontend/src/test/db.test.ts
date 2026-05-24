/**
 * Testes de IndexedDB via fake-indexeddb (in-memory).
 * Setup em src/test/setup.ts injeta fake-indexeddb/auto globalmente.
 *
 * Cada describe abre/fecha seu próprio banco para isolamento total.
 * Os testes cobrem: persistência, filtragem por synced, marcar como synced,
 * filtro por profissional+data, campos clínicos, e fluxo completo offline→sync.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ACSDatabase } from '../db'
import type { RegistroVisita } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDb(name = `test-db-${Math.random()}`) {
  return new ACSDatabase(name)
}

const HOJE = '2026-05-20'

const BASE: Omit<RegistroVisita, 'id'> = {
  pacienteId: 'p001',
  profissionalId: 'acs-001',
  dataVisita: HOJE,
  hora: '09:30',
  synced: false,
  createdAt: 1_000_000,
  estavaCasa: true,
  recusouVisita: false,
  observacoesGerais: '',
}

async function adicionar(db: ACSDatabase, overrides: Partial<Omit<RegistroVisita, 'id'>> = {}) {
  return db.visitas.add({ ...BASE, ...overrides } as Omit<RegistroVisita, 'id'>)
}

async function pendentes(db: ACSDatabase) {
  const todos = await db.visitas.toArray()
  return todos.filter((v) => !v.synced)
}

async function sincronizar(db: ACSDatabase, ids: number[]) {
  if (ids.length === 0) return
  await db.transaction('rw', db.visitas, async () => {
    await Promise.all(ids.map((id) => db.visitas.update(id, { synced: true })))
  })
}

async function visitasHoje(db: ACSDatabase, profissionalId: string, data: string) {
  return db.visitas
    .where('profissionalId')
    .equals(profissionalId)
    .and((v) => v.dataVisita === data)
    .toArray()
}

// ─── Persistência básica ─────────────────────────────────────────────────────

describe('persistência básica', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('salva um registro e retorna id numérico', async () => {
    const id = await adicionar(db)
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('ids são únicos por registro', async () => {
    const id1 = await adicionar(db)
    const id2 = await adicionar(db, { pacienteId: 'p002' })
    expect(id1).not.toBe(id2)
  })

  it('registro sobrevive close + reopen', async () => {
    const id = await adicionar(db)
    await db.close()
    await db.open()
    const salvo = await db.visitas.get(id)
    expect(salvo?.pacienteId).toBe('p001')
  })

  it('todos os campos escalares persistem fielmente', async () => {
    const id = await adicionar(db, {
      hora: '14:22',
      observacoesGerais: 'Anotação de teste',
      createdAt: 999,
    })
    const salvo = await db.visitas.get(id)
    expect(salvo?.hora).toBe('14:22')
    expect(salvo?.observacoesGerais).toBe('Anotação de teste')
    expect(salvo?.createdAt).toBe(999)
  })
})

// ─── Filtragem por synced ─────────────────────────────────────────────────────

describe('getVisitasPendentes', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('retorna apenas registros com synced=false', async () => {
    await adicionar(db)                                              // pendente
    await adicionar(db, { pacienteId: 'p002', synced: true })       // já synced
    await adicionar(db, { pacienteId: 'p003' })                     // pendente

    const result = await pendentes(db)
    expect(result).toHaveLength(2)
    expect(result.every((v) => v.synced === false)).toBe(true)
  })

  it('retorna vazio quando tudo está synced', async () => {
    await adicionar(db, { synced: true })
    expect(await pendentes(db)).toHaveLength(0)
  })

  it('retorna vazio em banco vazio', async () => {
    expect(await pendentes(db)).toHaveLength(0)
  })
})

// ─── marcarComoSynced ────────────────────────────────────────────────────────

describe('marcarComoSynced', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('atualiza synced=true apenas nos ids informados', async () => {
    const id1 = await adicionar(db)
    const id2 = await adicionar(db, { pacienteId: 'p002' })

    await sincronizar(db, [id1])

    const v1 = await db.visitas.get(id1)
    const v2 = await db.visitas.get(id2)
    expect(v1?.synced).toBe(true)
    expect(v2?.synced).toBe(false)
  })

  it('após sync parcial, pendentes só contém os não-sincronizados', async () => {
    const id1 = await adicionar(db)
    await adicionar(db, { pacienteId: 'p002' })

    await sincronizar(db, [id1])

    const result = await pendentes(db)
    expect(result).toHaveLength(1)
    expect(result[0].pacienteId).toBe('p002')
  })

  it('ids inexistentes não causam erro', async () => {
    await expect(sincronizar(db, [9999])).resolves.not.toThrow()
  })

  it('lista vazia não causa erro', async () => {
    await expect(sincronizar(db, [])).resolves.not.toThrow()
  })
})

// ─── Filtro por profissional + data ──────────────────────────────────────────

describe('getVisitasHoje', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('retorna visitas do profissional na data correta', async () => {
    await adicionar(db, { dataVisita: HOJE, profissionalId: 'acs-001' })
    await adicionar(db, { dataVisita: '2026-05-21', profissionalId: 'acs-001', pacienteId: 'p002' })
    await adicionar(db, { dataVisita: HOJE, profissionalId: 'acs-002', pacienteId: 'p003' })

    const result = await visitasHoje(db, 'acs-001', HOJE)
    expect(result).toHaveLength(1)
    expect(result[0].dataVisita).toBe(HOJE)
    expect(result[0].profissionalId).toBe('acs-001')
  })

  it('não retorna visitas de outro profissional', async () => {
    await adicionar(db, { profissionalId: 'acs-999' })
    expect(await visitasHoje(db, 'acs-001', HOJE)).toHaveLength(0)
  })

  it('não retorna visitas de outro dia', async () => {
    await adicionar(db, { dataVisita: '2026-05-19' })
    expect(await visitasHoje(db, 'acs-001', HOJE)).toHaveLength(0)
  })

  it('retorna múltiplas visitas do mesmo profissional no mesmo dia', async () => {
    await adicionar(db, { pacienteId: 'p001' })
    await adicionar(db, { pacienteId: 'p002' })
    await adicionar(db, { pacienteId: 'p003' })

    const result = await visitasHoje(db, 'acs-001', HOJE)
    expect(result).toHaveLength(3)
  })
})

// ─── Campos clínicos ─────────────────────────────────────────────────────────

describe('campos clínicos persistem intactos', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('campos de hipertensão são salvos e recuperados fielmente', async () => {
    const id = await adicionar(db, {
      adesaoMedicacaoHipertensao: 'irregular',
      pressaoAferidaHoje: true,
      valorPressao: '150/95',
      sintomas: 'cefaleia leve',
      tomaMedicacaoHipertensao: true,
    })
    const salvo = await db.visitas.get(id)
    expect(salvo?.adesaoMedicacaoHipertensao).toBe('irregular')
    expect(salvo?.pressaoAferidaHoje).toBe(true)
    expect(salvo?.valorPressao).toBe('150/95')
    expect(salvo?.sintomas).toBe('cefaleia leve')
    expect(salvo?.tomaMedicacaoHipertensao).toBe(true)
  })

  it('visita sem adesão salva adesaoMedicacaoHipertensao como undefined', async () => {
    const id = await adicionar(db)
    const salvo = await db.visitas.get(id)
    expect(salvo?.adesaoMedicacaoHipertensao).toBeUndefined()
  })

  it('visita com "não estava em casa" não tem campos clínicos', async () => {
    const id = await adicionar(db, { estavaCasa: false, recusouVisita: false })
    const salvo = await db.visitas.get(id)
    expect(salvo?.estavaCasa).toBe(false)
    expect(salvo?.valorPressao).toBeUndefined()
    expect(salvo?.sintomas).toBeUndefined()
  })

  it('campos de diabetes persistem corretamente', async () => {
    const id = await adicionar(db, {
      tomaMedicacaoDiabetes: true,
      tomaInsulina: false,
      fazDieta: true,
      ultimaGlicemia: '145 mg/dL em 15/05',
      peDiabetico: false,
    })
    const salvo = await db.visitas.get(id)
    expect(salvo?.tomaMedicacaoDiabetes).toBe(true)
    expect(salvo?.tomaInsulina).toBe(false)
    expect(salvo?.ultimaGlicemia).toBe('145 mg/dL em 15/05')
  })

  it('campos de gestação persistem corretamente', async () => {
    const id = await adicionar(db, {
      semanaGestacional: 28,
      preNatalEmDia: true,
      edema: false,
    })
    const salvo = await db.visitas.get(id)
    expect(salvo?.semanaGestacional).toBe(28)
    expect(salvo?.preNatalEmDia).toBe(true)
    expect(salvo?.edema).toBe(false)
  })
})

// ─── Fluxo completo: offline → sync ─────────────────────────────────────────

describe('fluxo offline → sync', () => {
  let db: ACSDatabase

  beforeEach(() => { db = makeDb() })
  afterEach(async () => { await db.delete() })

  it('registra 5 visitas offline e sincroniza todas de uma vez', async () => {
    for (const pid of ['p001', 'p002', 'p003', 'p004', 'p005']) {
      await adicionar(db, { pacienteId: pid })
    }

    const fila = await pendentes(db)
    expect(fila).toHaveLength(5)

    await sincronizar(db, fila.map((v) => v.id!))

    expect(await pendentes(db)).toHaveLength(0)
  })

  it('sync parcial (rede caiu no meio) deixa restantes na fila', async () => {
    const id1 = await adicionar(db, { pacienteId: 'p001' })
    await adicionar(db, { pacienteId: 'p002' })
    await adicionar(db, { pacienteId: 'p003' })

    // só sincronizou 1 de 3
    await sincronizar(db, [id1])

    const restantes = await pendentes(db)
    expect(restantes).toHaveLength(2)
    expect(restantes.map((v) => v.pacienteId)).toEqual(
      expect.arrayContaining(['p002', 'p003'])
    )
  })

  it('rejeitar visita (não estava em casa) também vai para a fila de sync', async () => {
    await adicionar(db, { estavaCasa: false })
    const fila = await pendentes(db)
    expect(fila).toHaveLength(1)
    expect(fila[0].estavaCasa).toBe(false)
  })
})
